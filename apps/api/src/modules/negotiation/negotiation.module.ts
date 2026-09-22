import { Module } from "@nestjs/common";

/**
 * NegotiationModule — Offer/counter-offer thread on a listing between one farmer and one retailer; negotiation state machine (docs/order-state-machine.md §1).
 *
 * Not yet implemented: this is a Foundation-phase placeholder so the module boundary and its position
 * in AppModule exist from day one (docs/architecture.md §4). Business logic arrives in the Negotiation
 * phase (docs/architecture.md §9). No module reaches into another module's database tables directly —
 * only through that module's own service class, once one exists (ADR-0001).
 */
@Module({})
export class NegotiationModule {}
