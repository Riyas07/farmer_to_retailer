/**
 * Enums shared across apps/api, apps/web and apps/admin.
 *
 * Source of truth: docs/erd.md and docs/order-state-machine.md. Keep these in lockstep with the
 * approved design docs — if a value here and a value in the docs disagree, the docs win and this
 * file is out of date, not the other way around.
 */

export enum UserRole {
  FARMER = "FARMER",
  RETAILER = "RETAILER",
  ADMIN = "ADMIN",
}

export enum UserStatus {
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

/** otp_challenges.purpose — login/signup auth only. Never used for pickup handover, see docs/architecture.md §5.1. */
export enum OtpPurpose {
  SIGNUP = "SIGNUP",
  LOGIN = "LOGIN",
}

export enum VerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

/** farmer_profiles.gateway_linked_account_status — the gateway's own KYC status, independent of VerificationStatus. */
export enum LinkedAccountStatus {
  NOT_STARTED = "NOT_STARTED",
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  REJECTED = "REJECTED",
}

export enum UnitOfMeasure {
  KG = "KG",
  QUINTAL = "QUINTAL",
  DOZEN = "DOZEN",
  UNIT = "UNIT",
}

export enum QualityGrade {
  A = "A",
  B = "B",
  C = "C",
}

export enum ListingStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  SOLD_OUT = "SOLD_OUT",
  EXPIRED = "EXPIRED",
  REMOVED = "REMOVED",
}

export enum NegotiationStatus {
  OPEN = "OPEN",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

export enum NegotiationSenderRole {
  FARMER = "FARMER",
  RETAILER = "RETAILER",
}

/**
 * orders.status — see docs/order-state-machine.md §2 for the full diagram and transition table.
 *
 * `PICKED_UP` has two sub-phases distinguished by `payouts.status` (ON_HOLD vs RELEASED), not by a
 * separate `orders.status` value — see {@link PayoutSubPhase}. `RESOLVED_RESUME` from the diagram is
 * deliberately NOT a member here: the doc explicitly allows it to be a transient routing step that
 * resumes directly to the correct concrete state (`READY_FOR_PICKUP` or `PICKED_UP`) rather than a
 * persisted status — see order-state-machine.md's note under the diagram.
 */
export enum OrderStatus {
  PENDING_PAYMENT = "PENDING_PAYMENT",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  CONFIRMED = "CONFIRMED",
  PICKUP_SCHEDULED = "PICKUP_SCHEDULED",
  READY_FOR_PICKUP = "READY_FOR_PICKUP",
  PICKED_UP = "PICKED_UP",
  DISPUTED = "DISPUTED",
  REFUNDED = "REFUNDED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/**
 * Derived, not stored as its own column: which sub-phase an order in `PICKED_UP` is in, read off
 * `payouts.status`. See docs/order-state-machine.md §2 ("PICKED_UP therefore has two internal
 * sub-phases..."). ON_HOLD -> payout_on_hold (routine/low-risk dispute window), RELEASED ->
 * payout_released (escalated/higher-risk dispute window).
 */
export enum PayoutSubPhase {
  PAYOUT_ON_HOLD = "payout_on_hold",
  PAYOUT_RELEASED = "payout_released",
}

export enum DisputeCategory {
  QUALITY = "QUALITY",
  QUANTITY = "QUANTITY",
  NO_SHOW = "NO_SHOW",
  PAYMENT = "PAYMENT",
  OTHER = "OTHER",
}

export enum DisputeStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED_REFUND = "RESOLVED_REFUND",
  RESOLVED_PARTIAL_REFUND = "RESOLVED_PARTIAL_REFUND",
  RESOLVED_NO_ACTION = "RESOLVED_NO_ACTION",
  REJECTED = "REJECTED",
}

export enum CommissionRuleType {
  PERCENTAGE = "PERCENTAGE",
  FLAT = "FLAT",
}

/** payments.provider / payouts.provider — provider-neutral by design, see ADR-0005. No provider chosen yet. */
export enum PaymentProvider {
  MOCK = "MOCK",
  RAZORPAY = "RAZORPAY",
  CASHFREE = "CASHFREE",
}

export enum PaymentMethod {
  UPI = "UPI",
  CARD = "CARD",
  NETBANKING = "NETBANKING",
  WALLET = "WALLET",
  OTHER = "OTHER",
}

export enum PaymentStatus {
  CREATED = "CREATED",
  AUTHORIZED = "AUTHORIZED",
  CAPTURED = "CAPTURED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

/**
 * payouts.status — RELEASED and SETTLED are deliberately distinct, confirmed-separate events for
 * both candidate providers. See docs/decisions/provider-capabilities-payment-split.md and
 * docs/erd.md's `payouts` table notes. `orders.status` only reaches COMPLETED on SETTLED.
 */
export enum PayoutStatus {
  ON_HOLD = "ON_HOLD",
  RELEASED = "RELEASED",
  SETTLED = "SETTLED",
  REVERSED = "REVERSED",
  PARTIALLY_REVERSED = "PARTIALLY_REVERSED",
  FAILED = "FAILED",
}

export enum ReconciliationStatus {
  UNRECONCILED = "UNRECONCILED",
  RECONCILED = "RECONCILED",
  MISMATCH = "MISMATCH",
}

export enum NotificationChannelType {
  SMS = "SMS",
  PUSH = "PUSH",
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}
