import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ConfigModule } from "./config/config.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProvidersModule } from "./providers/providers.module.js";
import { HealthModule } from "./health/health.module.js";

import { AuthModule } from "./modules/auth/auth.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { FarmerProfileModule } from "./modules/farmer-profile/farmer-profile.module.js";
import { RetailerProfileModule } from "./modules/retailer-profile/retailer-profile.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { MatchingModule } from "./modules/matching/matching.module.js";
import { NegotiationModule } from "./modules/negotiation/negotiation.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";
import { CommissionModule } from "./modules/commission/commission.module.js";
import { PaymentsModule } from "./modules/payments/payments.module.js";
import { DisputesModule } from "./modules/disputes/disputes.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";

@Module({
  imports: [
    // Cross-cutting infrastructure
    ConfigModule,
    PrismaModule,
    ProvidersModule,
    // In-process domain event bus (docs/architecture.md §4) — the seam where a future extraction into
    // a real message queue (SQS/SNS) would happen, without touching publishers.
    EventEmitterModule.forRoot(),
    HealthModule,

    // Domain modules — see docs/architecture.md §4 for the module map. All currently empty scaffolds;
    // business logic is added module-by-module starting with the Users phase (docs/architecture.md §9).
    AuthModule,
    UsersModule,
    FarmerProfileModule,
    RetailerProfileModule,
    CatalogModule,
    MatchingModule,
    NegotiationModule,
    OrdersModule,
    CommissionModule,
    PaymentsModule,
    DisputesModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule {}
