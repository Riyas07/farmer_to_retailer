import { Module } from "@nestjs/common";

/**
 * OrdersModule — Order creation from an accepted negotiation; order state machine including the payout hold window; pickup scheduling & confirmation via its own pickup handover code (docs/order-state-machine.md §2).
 *
 * Not yet implemented: this is a Foundation-phase placeholder so the module boundary and its position
 * in AppModule exist from day one (docs/architecture.md §4). Business logic arrives in the Orders
 * phase (docs/architecture.md §9). No module reaches into another module's database tables directly —
 * only through that module's own service class, once one exists (ADR-0001).
 */
@Module({})
export class OrdersModule {}
