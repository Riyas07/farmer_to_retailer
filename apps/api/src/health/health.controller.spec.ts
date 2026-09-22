import { jest } from "@jest/globals";
import { HealthController } from "./health.controller.js";
import { PrismaService } from "../prisma/prisma.service.js";

describe("HealthController", () => {
  it("liveness reports ok without touching the database", () => {
    const controller = new HealthController({} as PrismaService);
    const result = controller.liveness();
    expect(result.status).toBe("ok");
    expect(new Date(result.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("readiness reports ok when the database responds", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);
    const result = await controller.readiness();
    expect(result).toMatchObject({ status: "ok", database: "ok" });
  });

  it("readiness reports error when the database throws", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);
    const result = await controller.readiness();
    expect(result).toMatchObject({ status: "error", database: "error" });
  });
});
