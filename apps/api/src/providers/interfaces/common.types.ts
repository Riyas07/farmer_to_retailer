import type { LatLng } from "@farmer-to-retailer/shared-types";

export type { LatLng };

/**
 * Shared payload/result shapes for the provider interfaces below. These are the Foundation-phase
 * contract for the Payments module (docs/architecture.md §5.1) — deliberately NOT full request/response
 * DTOs for any REST endpoint (those arrive with the Payments phase itself, per docs/architecture.md §9).
 */

export interface FarmerLinkedAccountInput {
  farmerProfileId: string;
  fullName: string;
  phoneE164: string;
  /** KYC fields required by the chosen gateway's linked-account/sub-merchant onboarding — shape is
   * intentionally loose here since no provider is chosen yet (ADR-0005); a real adapter narrows this. */
  kyc: Record<string, unknown>;
}

export type LinkedAccountStatusValue =
  "NOT_STARTED" | "PENDING" | "ACTIVE" | "REJECTED";

export interface SplitPaymentInput {
  orderId: string;
  /** Total the retailer pays, INR, in rupees (not paise) — the adapter converts units as needed. */
  totalAmount: number;
  /** The farmer's share, routed to their linked account as an on-hold transfer (ADR-0005). */
  payoutAmount: number;
  currency: "INR";
  farmerLinkedAccountId: string;
}

export interface PaymentWebhookEvent {
  /** Raw event type string as the gateway sends it, e.g. "payment.captured", "transfer.settled". Not
   * narrowed to a union yet — the exact event catalogue differs per provider and per
   * docs/decisions/provider-capabilities-payment-split.md §9 several are still UNCONFIRMED for Cashfree. */
  eventType: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerTransferId?: string;
  occurredAt: Date;
  raw: unknown;
}

export interface TransferResult {
  providerTransferId: string;
  /** See docs/order-state-machine.md — RELEASED means the hold was lifted at the gateway, NOT that
   * funds have landed in the farmer's bank. Callers must still wait for a settlement-confirmed webhook. */
  status: "ON_HOLD" | "RELEASED" | "REVERSED" | "PARTIALLY_REVERSED" | "FAILED";
  amount: number;
}

export interface RefundResult {
  providerPaymentId: string;
  refundedAmount: number;
  status: "REFUNDED" | "PARTIALLY_REFUNDED" | "FAILED";
}

export interface NotificationTemplate {
  key: string;
  /** Human-readable fallback subject/title — real copy/localization is a Notifications-phase concern. */
  title: string;
}
