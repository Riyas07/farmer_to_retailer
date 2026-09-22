/**
 * docs/architecture.md §5.1 — used only by the `auth` module for login/signup OTP delivery, and by
 * `orders` for reading the pickup handover code aloud as an SMS backup to in-app display. These two
 * uses are structurally separate systems (OtpChallenge vs PickupHandoverCode) that happen to share this
 * one delivery interface.
 */
export interface SmsProvider {
  sendOtp(phoneE164: string, otp: string): Promise<void>;
  sendPickupCode(
    phoneE164: string,
    code: string,
    orderId: string,
  ): Promise<void>;
}
