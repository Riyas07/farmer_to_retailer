import { Module } from "@nestjs/common";

/**
 * CatalogModule — Produce categories, units of measure, listings. Serializes only a coarse location on every public/browse and negotiation-facing endpoint (docs/erd.md §3).
 *
 * Not yet implemented: this is a Foundation-phase placeholder so the module boundary and its position
 * in AppModule exist from day one (docs/architecture.md §4). Business logic arrives in the Marketplace
 * phase (docs/architecture.md §9). No module reaches into another module's database tables directly —
 * only through that module's own service class, once one exists (ADR-0001).
 */
@Module({})
export class CatalogModule {}
