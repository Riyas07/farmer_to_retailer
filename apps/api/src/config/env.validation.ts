import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from "class-validator";

/**
 * Every config value the API actually reads, validated at boot so a missing/malformed env var fails
 * fast with a clear message instead of surfacing as a confusing runtime error three requests later.
 * Add a field here whenever a module starts reading a new env var — see ConfigModule in config.module.ts.
 */
export class EnvironmentVariables {
  @IsIn(["development", "test", "production"])
  NODE_ENV: "development" | "test" | "production" = "development";

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsUrl({ protocols: ["postgresql", "postgres"], require_tld: false })
  DATABASE_URL: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN: string = "";

  @IsInt()
  @Min(1)
  PAYOUT_HOLD_WINDOW_HOURS: number = 48;

  @IsInt()
  @Min(0)
  MOCK_PAYMENT_SETTLEMENT_LAG_MS: number = 3000;

  @IsInt()
  @Min(1)
  MOCK_PAYMENT_HOLD_CEILING_DAYS: number = 45;

  @IsInt()
  @Min(0)
  MOCK_PAYMENT_LINKED_ACCOUNT_ACTIVATION_DELAY_MS: number = 0;

  @IsOptional()
  @IsString()
  AWS_REGION?: string;

  @IsOptional()
  @IsString()
  AWS_S3_BUCKET?: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(", "))
        .join("\n")}`,
    );
  }

  return validatedConfig;
}
