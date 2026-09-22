import { Global, Module } from "@nestjs/common";
import {
  GEO_PROVIDER,
  NOTIFICATION_CHANNEL,
  PAYMENT_GATEWAY_PROVIDER,
  SMS_PROVIDER,
  STORAGE_PROVIDER,
} from "./tokens.js";
import { HaversineGeoProvider } from "./geo/geo.provider.js";
import { S3StorageProvider } from "./storage/s3-storage.provider.js";
import { MockSmsProvider } from "./mock/mock-sms.provider.js";
import { MockPaymentGatewayProvider } from "./mock/mock-payment-gateway.provider.js";
import { MockNotificationChannel } from "./mock/mock-notification.channel.js";

/**
 * Binds each provider interface (docs/architecture.md §5) to its V1 implementation behind a DI token.
 * Swapping a real gateway/SMS/notification implementation in later is a matter of changing the
 * `useClass` here (or making it config-driven) — no call-site changes anywhere else in the app.
 *
 * V1 bindings, per docs/architecture.md §5.1: SMS, payment gateway and notifications are mocked;
 * geo (haversine) and storage (S3) are real from day one since neither needs a vendor account to be safe.
 */
@Global()
@Module({
  providers: [
    { provide: SMS_PROVIDER, useClass: MockSmsProvider },
    { provide: PAYMENT_GATEWAY_PROVIDER, useClass: MockPaymentGatewayProvider },
    { provide: NOTIFICATION_CHANNEL, useClass: MockNotificationChannel },
    { provide: GEO_PROVIDER, useClass: HaversineGeoProvider },
    { provide: STORAGE_PROVIDER, useClass: S3StorageProvider },
  ],
  exports: [
    SMS_PROVIDER,
    PAYMENT_GATEWAY_PROVIDER,
    NOTIFICATION_CHANNEL,
    GEO_PROVIDER,
    STORAGE_PROVIDER,
  ],
})
export class ProvidersModule {}
