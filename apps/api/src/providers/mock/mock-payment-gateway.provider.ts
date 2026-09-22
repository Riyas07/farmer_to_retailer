import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  FarmerLinkedAccountInput,
  LinkedAccountStatusValue,
  PaymentGatewayProvider,
  PaymentWebhookEvent,
  RefundResult,
  SplitPaymentInput,
  TransferResult,
} from "../interfaces/index.js";

interface LinkedAccountRecord {
  linkedAccountId: string;
  status: LinkedAccountStatusValue;
}

type TransferStatus =
  | "ON_HOLD"
  | "RELEASED"
  | "SETTLED"
  | "REVERSED"
  | "PARTIALLY_REVERSED"
  | "FAILED";

interface TransferRecord {
  providerTransferId: string;
  orderId: string;
  amount: number;
  status: TransferStatus;
  holdCeiling: Date;
  releasedAt?: Date;
  settledAt?: Date;
  reversedAmount: number;
}

/**
 * Deliberately simulates the HARDER of the two real candidate providers' behavior, not the easier one —
 * per docs/decisions/provider-capabilities-payment-split.md §8. See docs/architecture.md §5.1 for the
 * full description this class implements:
 *
 *  - linked-account creation with a configurable activation delay (default instant, overridable)
 *  - split-payment creation that respects `holdCeiling`
 *  - a genuinely two-phase release, with a configurable RELEASED -> SETTLED lag, so the
 *    "released but not yet settled" dispute-race window (docs/order-state-machine.md) is exercisable
 *  - an auto-release-at-ceiling behavior mirroring Cashfree's 45-day hard cap (checked lazily on read,
 *    not via a long-lived timer — see the note on maybeAutoReleaseAtCeiling below)
 *  - reduce/reverse calls that can be made to fail on demand, for testing the escalated-dispute path
 *
 * This lets the whole hold-window / settlement-gate / ceiling-alert logic that `orders` and `payments`
 * will implement in a later phase be exercised long before a real Razorpay/Cashfree account exists.
 */
@Injectable()
export class MockPaymentGatewayProvider implements PaymentGatewayProvider {
  private readonly logger = new Logger(MockPaymentGatewayProvider.name);

  private readonly linkedAccounts = new Map<string, LinkedAccountRecord>();
  private readonly transfers = new Map<string, TransferRecord>();
  private readonly forceFailReduce = new Set<string>();
  private readonly forceFailReverse = new Set<string>();
  private readonly forceFailRefund = new Set<string>();

  private readonly settlementLagMs: number;
  private readonly linkedAccountActivationDelayMs: number;

  constructor(private readonly config: ConfigService) {
    this.settlementLagMs =
      this.config.get<number>("MOCK_PAYMENT_SETTLEMENT_LAG_MS") ?? 3000;
    this.linkedAccountActivationDelayMs =
      this.config.get<number>(
        "MOCK_PAYMENT_LINKED_ACCOUNT_ACTIVATION_DELAY_MS",
      ) ?? 0;
  }

  // -- Linked account onboarding ------------------------------------------------------------------

  async createLinkedAccount(
    _input: FarmerLinkedAccountInput,
  ): Promise<{ linkedAccountId: string; status: LinkedAccountStatusValue }> {
    const linkedAccountId = `mock_la_${randomUUID()}`;
    const startsActive = this.linkedAccountActivationDelayMs <= 0;
    const record: LinkedAccountRecord = {
      linkedAccountId,
      status: startsActive ? "ACTIVE" : "PENDING",
    };
    this.linkedAccounts.set(linkedAccountId, record);

    if (!startsActive) {
      setTimeout(() => {
        const current = this.linkedAccounts.get(linkedAccountId);
        if (current && current.status === "PENDING") {
          current.status = "ACTIVE";
          this.logger.log(
            `[MOCK GATEWAY] Linked account ${linkedAccountId} activated`,
          );
        }
      }, this.linkedAccountActivationDelayMs);
    }

    return { linkedAccountId, status: record.status };
  }

  async getLinkedAccountStatus(
    linkedAccountId: string,
  ): Promise<LinkedAccountStatusValue> {
    const record = this.linkedAccounts.get(linkedAccountId);
    if (!record) {
      throw new Error(`Unknown mock linked account: ${linkedAccountId}`);
    }
    return record.status;
  }

  // -- Split payment / held transfer ---------------------------------------------------------------

  async createSplitPayment(
    input: SplitPaymentInput & { holdCeiling: Date },
  ): Promise<{ providerOrderId: string; clientPayload: unknown }> {
    const providerOrderId = `mock_order_${randomUUID()}`;
    const providerTransferId = `mock_transfer_${randomUUID()}`;

    this.transfers.set(providerTransferId, {
      providerTransferId,
      orderId: input.orderId,
      amount: input.payoutAmount,
      status: "ON_HOLD",
      holdCeiling: input.holdCeiling,
      reversedAmount: 0,
    });

    this.logger.log(
      `[MOCK GATEWAY] Split payment created for order ${input.orderId}: total ${input.totalAmount}, ` +
        `payout ${input.payoutAmount} held as ${providerTransferId} (ceiling ${input.holdCeiling.toISOString()})`,
    );

    return {
      providerOrderId,
      clientPayload: {
        mock: true,
        providerOrderId,
        providerTransferId,
        amount: input.totalAmount,
      },
    };
  }

  verifyWebhookSignature(_rawBody: Buffer, signature: string): boolean {
    // No real webhook sender exists for the mock — this is a test hook: pass "__invalid__" to exercise
    // the signature-rejection path in a caller.
    return signature !== "__invalid__";
  }

  parseWebhookEvent(rawBody: Buffer): PaymentWebhookEvent {
    const parsed = JSON.parse(
      rawBody.toString("utf-8"),
    ) as Partial<PaymentWebhookEvent>;
    return {
      eventType: parsed.eventType ?? "unknown",
      providerOrderId: parsed.providerOrderId,
      providerPaymentId: parsed.providerPaymentId,
      providerTransferId: parsed.providerTransferId,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : new Date(),
      raw: parsed.raw ?? parsed,
    };
  }

  // -- Transfer lifecycle ---------------------------------------------------------------------------

  async releaseTransfer(providerTransferId: string): Promise<TransferResult> {
    const record = this.getTransfer(providerTransferId);
    this.maybeAutoReleaseAtCeiling(record);

    if (record.status === "ON_HOLD") {
      record.status = "RELEASED";
      record.releasedAt = new Date();
      this.logger.log(
        `[MOCK GATEWAY] Transfer ${providerTransferId} released (hold lifted)`,
      );

      // Genuinely separate, later settlement signal — see docs/order-state-machine.md and
      // provider-capabilities-payment-split.md §6. Callers must observe this via parseWebhookEvent /
      // getTransferSnapshot, not assume release == paid.
      setTimeout(() => {
        if (record.status === "RELEASED") {
          record.status = "SETTLED";
          record.settledAt = new Date();
          this.logger.log(
            `[MOCK GATEWAY] Transfer ${providerTransferId} settled`,
          );
        }
      }, this.settlementLagMs);
    }

    return this.toTransferResult(record);
  }

  async reduceTransfer(
    providerTransferId: string,
    newAmount: number,
  ): Promise<TransferResult> {
    const record = this.getTransfer(providerTransferId);
    this.maybeAutoReleaseAtCeiling(record);

    // A forced/simulated failure or an attempt against an already-terminal transfer reports FAILED
    // without mutating the stored record — a failed attempt doesn't itself change the transfer's real
    // state, so a retry (once the simulated failure is cleared) can still succeed normally.
    if (
      this.forceFailReduce.delete(providerTransferId) ||
      this.isTerminal(record.status)
    ) {
      return { providerTransferId, status: "FAILED", amount: record.amount };
    }

    record.amount = newAmount;
    record.status = "PARTIALLY_REVERSED";
    return this.toTransferResult(record);
  }

  async reverseTransfer(providerTransferId: string): Promise<TransferResult> {
    const record = this.getTransfer(providerTransferId);
    this.maybeAutoReleaseAtCeiling(record);

    // See the comment in reduceTransfer above — a forced/simulated failure never mutates stored state.
    if (
      this.forceFailReverse.delete(providerTransferId) ||
      this.isTerminal(record.status)
    ) {
      return { providerTransferId, status: "FAILED", amount: record.amount };
    }

    record.reversedAmount = record.amount;
    record.status = "REVERSED";
    return this.toTransferResult(record);
  }

  async refundPayment(
    providerPaymentId: string,
    amount: number,
  ): Promise<RefundResult> {
    if (this.forceFailRefund.delete(providerPaymentId)) {
      return { providerPaymentId, refundedAmount: 0, status: "FAILED" };
    }
    return { providerPaymentId, refundedAmount: amount, status: "REFUNDED" };
  }

  // -- Mock-only test hooks (not part of PaymentGatewayProvider) ------------------------------------

  /** Inspect a transfer's current state — e.g. to assert on release/settlement timing in tests. */
  getTransferSnapshot(providerTransferId: string): Readonly<TransferRecord> {
    const record = this.getTransfer(providerTransferId);
    this.maybeAutoReleaseAtCeiling(record);
    return { ...record };
  }

  simulateReduceFailure(providerTransferId: string): void {
    this.forceFailReduce.add(providerTransferId);
  }

  simulateReverseFailure(providerTransferId: string): void {
    this.forceFailReverse.add(providerTransferId);
  }

  simulateRefundFailure(providerPaymentId: string): void {
    this.forceFailRefund.add(providerPaymentId);
  }

  // -- Internals --------------------------------------------------------------------------------------

  private getTransfer(providerTransferId: string): TransferRecord {
    const record = this.transfers.get(providerTransferId);
    if (!record) {
      throw new Error(`Unknown mock transfer: ${providerTransferId}`);
    }
    return record;
  }

  private isTerminal(status: TransferStatus): boolean {
    return status === "REVERSED" || status === "SETTLED" || status === "FAILED";
  }

  /**
   * Mirrors Cashfree's hard 45-day hold ceiling (docs/decisions/provider-capabilities-payment-split.md
   * §3, §8.4): if nobody has released the transfer before `holdCeiling`, the provider force-releases it
   * regardless of our own state machine. Checked lazily on every read/write rather than via a long-lived
   * `setTimeout` — Node's timer delay is a 32-bit signed int (~24.8 days max), so scheduling a real
   * 45-day timeout would silently overflow and fire almost immediately. A lazy check has no such limit
   * and is exactly how a real reconciliation-sweep job would learn about this anyway.
   */
  private maybeAutoReleaseAtCeiling(record: TransferRecord): void {
    if (
      record.status === "ON_HOLD" &&
      Date.now() >= record.holdCeiling.getTime()
    ) {
      record.status = "RELEASED";
      record.releasedAt = record.holdCeiling;
      this.logger.warn(
        `[MOCK GATEWAY] Transfer ${record.providerTransferId} auto-released at hold ceiling ` +
          `(${record.holdCeiling.toISOString()}) — order ${record.orderId} needs ceiling-alert handling`,
      );
    }
  }

  private toTransferResult(record: TransferRecord): TransferResult {
    return {
      providerTransferId: record.providerTransferId,
      status: record.status === "SETTLED" ? "RELEASED" : record.status,
      amount: record.amount,
    };
  }
}
