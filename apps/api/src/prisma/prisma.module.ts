import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

/** Global so every domain module can inject PrismaService without re-importing this module everywhere. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
