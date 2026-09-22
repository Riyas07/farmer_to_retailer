/**
 * NestJS DI tokens for the pluggable provider interfaces (docs/architecture.md §5). Binding a
 * different implementation per environment is a ProvidersModule + config change — no call-site
 * changes. See providers.module.ts.
 */
export const SMS_PROVIDER = Symbol("SMS_PROVIDER");
export const PAYMENT_GATEWAY_PROVIDER = Symbol("PAYMENT_GATEWAY_PROVIDER");
export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
export const GEO_PROVIDER = Symbol("GEO_PROVIDER");
export const NOTIFICATION_CHANNEL = Symbol("NOTIFICATION_CHANNEL");
