import { Module } from "@nestjs/common";

/**
 * DisputesModule — Raise/track/resolve disputes tied to an order; resolution actions (refund, partial refund, release, reject).
 *
 * Not yet implemented: this is a Foundation-phase placeholder so the module boundary and its position
 * in AppModule exist from day one (docs/architecture.md §4). Business logic arrives in the Disputes
 * phase (docs/architecture.md §9). No module reaches into another module's database tables directly —
 * only through that module's own service class, once one exists (ADR-0001).
 */
@Module({})
export class DisputesModule {}
