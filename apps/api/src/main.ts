import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Fail fast on any request whose body doesn't match its DTO once endpoints start using class-validator
  // decorators (Users phase onward) — cheap to enable now, harmless while there are no DTOs yet.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const corsOrigin = config.get<string>("CORS_ORIGIN") ?? "";
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(",").map((o) => o.trim()) });
  }

  app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });

  const port = config.get<number>("PORT") ?? 3000;
  await app.listen(port);
  console.log(`API listening on :${port}`);
}

bootstrap();
