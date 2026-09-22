import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — process is up. Used by the ALB/ECS health check (docs/architecture.md §7). */
  @Get()
  liveness(): { status: "ok"; timestamp: string } {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  /** Readiness — process is up AND can reach Postgres. */
  @Get("ready")
  async readiness(): Promise<{
    status: "ok" | "error";
    database: "ok" | "error";
    timestamp: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "ok",
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: "error",
        database: "error",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
