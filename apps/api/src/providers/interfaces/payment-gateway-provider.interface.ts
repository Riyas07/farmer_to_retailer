import type {
  FarmerLinkedAccountInput,
  LinkedAccountStatusValue,
  PaymentWebhookEvent,
  RefundResult,
  SplitPaymentInput,
  TransferResult,
} from "./common.types.js";

/**
 * docs/architecture.md §5.1 — provider-neutral gateway marketplace/split-payment interface (ADR-0005).
 * No provider chosen yet between Razorpay Route and Cashfree Easy Split — see
 * docs/decisions/provider-capabilities-payment-split.md for what's confirmed vs. still open per provider.
 */
export interface PaymentGatewayProvider {
  /** Farmer onboarding — required before an order can be confirmed for that farmer, not before they can list. */
  createLinkedAccount(
    input: FarmerLinkedAccountInput,
  ): Promise<{ linkedAccountId: string; status: LinkedAccountStatusValue }>;
  getLinkedAccountStatus(
    linkedAccountId: string,
  ): Promise<LinkedAccountStatusValue>;

  /**
   * Creates a gateway "order" with an on-hold transfer routing `payoutAmount` to the farmer's linked
   * account. The commission share is implicitly what's retained by the platform's own account.
   *
   * `holdCeiling`: the outer bound we're willing to commit to up front. Required for a Cashfree adapter
   * (maps to settlementEligibilityDate/max_eligibity_date, hard-capped by the provider at 45 days — see
   * provider-capabilities-payment-split.md §3); a Razorpay adapter can ignore it or use it as an initial
   * on_hold_until, since Razorpay has no real ceiling and lets us extend later anyway.
   */
  createSplitPayment(
    input: SplitPaymentInput & { holdCeiling: Date },
  ): Promise<{ providerOrderId: string; clientPayload: unknown }>;

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  parseWebhookEvent(rawBody: Buffer): PaymentWebhookEvent;

  /**
   * Transfer lifecycle — all act on the held transfer created by createSplitPayment, never on a new
   * payout. `releaseTransfer` only TRIGGERS release — it does not itself mean the farmer has been paid.
   * Both candidate providers confirm a separate, later settlement signal (see
   * provider-capabilities-payment-split.md §6); callers must wait for `parseWebhookEvent` to report a
   * settlement-confirmed event before treating the payout as final. Confirmed reliable on Razorpay;
   * Cashfree's exact mechanism/event names are unconfirmed — see that doc's §9.
   */
  releaseTransfer(providerTransferId: string): Promise<TransferResult>;
  /** Partial refund — Razorpay confirmed, Cashfree unconfirmed (provider-capabilities doc §4). */
  reduceTransfer(
    providerTransferId: string,
    newAmount: number,
  ): Promise<TransferResult>;
  /** Full refund — Razorpay confirmed, Cashfree unconfirmed (provider-capabilities doc §4). */
  reverseTransfer(providerTransferId: string): Promise<TransferResult>;

  refundPayment(
    providerPaymentId: string,
    amount: number,
  ): Promise<RefundResult>;
}
