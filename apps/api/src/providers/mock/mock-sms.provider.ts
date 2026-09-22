import { Injectable, Logger } from "@nestjs/common";
import type { SmsProvider } from "../interfaces/index.js";

/**
 * docs/architecture.md §5.1: "writes codes to a sms_log table + server console — nothing sent". Note:
 * docs/erd.md (the approved schema) has no `sms_log` table, so this Foundation-phase mock logs to the
 * server console plus an in-memory buffer (inspectable via `sentMessages`, mock-only, not part of the
 * SmsProvider interface) instead of inventing an unapproved table. Worth reconciling the two docs
 * before the Users phase actually builds `auth` against this.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  readonly sentMessages: Array<
    | { kind: "otp"; phoneE164: string; otp: string; sentAt: Date }
    | {
        kind: "pickup_code";
        phoneE164: string;
        code: string;
        orderId: string;
        sentAt: Date;
      }
  > = [];

  async sendOtp(phoneE164: string, otp: string): Promise<void> {
    this.sentMessages.push({ kind: "otp", phoneE164, otp, sentAt: new Date() });
    this.logger.log(`[MOCK SMS] OTP ${otp} -> ${phoneE164}`);
  }

  async sendPickupCode(
    phoneE164: string,
    code: string,
    orderId: string,
  ): Promise<void> {
    this.sentMessages.push({
      kind: "pickup_code",
      phoneE164,
      code,
      orderId,
      sentAt: new Date(),
    });
    this.logger.log(
      `[MOCK SMS] Pickup code ${code} -> ${phoneE164} (order ${orderId})`,
    );
  }
}
