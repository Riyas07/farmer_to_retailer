import type { NotificationTemplate } from "./common.types.js";

/** One per channel: SmsChannel, PushChannel, EmailChannel — all implement this. */
export interface NotificationChannel {
  send(
    userId: string,
    template: NotificationTemplate,
    data: Record<string, unknown>,
  ): Promise<void>;
}
