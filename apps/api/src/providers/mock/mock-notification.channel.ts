import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationChannelType,
  NotificationStatus,
} from "@farmer-to-retailer/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  NotificationChannel,
  NotificationTemplate,
} from "../interfaces/index.js";

/**
 * docs/architecture.md §5.1: "logs to a table, surfaced in admin for now instead of an actual
 * push/SMS/email send". Unlike MockSmsProvider, this one DOES have an approved backing table
 * (`notifications` in docs/erd.md), so it writes a real row via Prisma rather than an in-memory buffer.
 *
 * This is a single stand-in for all channels during Foundation phase. Per-channel classes
 * (SmsChannel/PushChannel/EmailChannel, one per NotificationChannelType) arrive with the Notifications
 * phase (docs/architecture.md §9, phase 8) — nothing calls this yet since `notifications` (the module)
 * isn't built either.
 */
@Injectable()
export class MockNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger(MockNotificationChannel.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(
    userId: string,
    template: NotificationTemplate,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`[MOCK NOTIFICATION] ${template.key} -> user ${userId}`);
    await this.prisma.notification.create({
      data: {
        userId,
        type: template.key,
        title: template.title,
        body: template.title,
        data: data as object,
        channel: NotificationChannelType.IN_APP,
        status: NotificationStatus.SENT,
      },
    });
  }
}
