import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around the generated Prisma client, injected wherever a module needs DB access.
 *
 * Per ADR-0001, Prisma's client isn't naturally scoped per-module the way a TypeORM repository
 * injected into a module is — module boundary discipline ("no module reaching into another module's
 * tables") is enforced by convention/review: each domain module should go through its own
 * repository/service class that wraps this client, not call `this.prisma.<otherModulesTable>` directly
 * from unrelated code.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to Postgres via Prisma");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
