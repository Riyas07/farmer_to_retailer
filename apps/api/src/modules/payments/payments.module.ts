import { Module } from "@nestjs/common";

/**
 * PaymentsModule — Split-payment creation with an on-hold farmer transfer, gateway webhook handling, payment status and reconciliation fields (ADR-0005, docs/decisions/provider-capabilities-payment-split.md).
 *
 * Not yet implemented: this is a Foundation-phase placeholder so the module boundary and its position
 * in AppModule exist from day one (docs/architecture.md §4). Business logic arrives in the Payments
 * phase (docs/architecture.md §9). No module reaches into another module's database tables directly —
 * only through that module's own service class, once one exists (ADR-0001).
 */
@Module({})
export class PaymentsModule {}
