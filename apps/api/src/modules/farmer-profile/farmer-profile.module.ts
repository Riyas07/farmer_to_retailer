import { Module } from "@nestjs/common";

/**
 * FarmerProfileModule — Farmer-specific data: farm location, gateway linked-account status, verification status.
 *
 * Not yet implemented: this is a Foundation-phase placeholder so the module boundary and its position
 * in AppModule exist from day one (docs/architecture.md §4). Business logic arrives in the Users
 * phase (docs/architecture.md §9). No module reaches into another module's database tables directly —
 * only through that module's own service class, once one exists (ADR-0001).
 */
@Module({})
export class FarmerProfileModule {}
