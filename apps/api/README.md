# apps/api

NestJS modular monolith backend — Foundation-phase scaffold. See
[`docs/architecture.md`](../../docs/architecture.md) and [`docs/erd.md`](../../docs/erd.md) for the
approved design this implements.

## What's here

- `src/main.ts`, `src/app.module.ts` — bootstrap, global validation pipe, `/api/v1` prefix (health checks
  excluded), CORS from `CORS_ORIGIN`.
- `src/config/` — env var validation (`class-validator`, fails fast on boot if misconfigured).
- `src/prisma/` — `PrismaService` wrapping the generated client; `prisma/schema.prisma` models the full
  approved ERD.
- `src/providers/` — the five pluggable provider interfaces from `docs/architecture.md` §5.1
  (`SmsProvider`, `PaymentGatewayProvider`, `StorageProvider`, `GeoProvider`, `NotificationChannel`) with
  their V1 bindings wired in `providers.module.ts`: mocked SMS/payment-gateway/notifications, real
  haversine geo, real (but unused-so-far) S3 storage.
- `src/health/` — liveness (`GET /health`) and readiness (`GET /health/ready`, checks Postgres).
- `src/modules/*` — one empty `@Module({})` stub per domain module in the architecture's module map
  (`auth`, `users`, `farmer-profile`, `retailer-profile`, `catalog`, `matching`, `negotiation`, `orders`,
  `commission`, `payments`, `disputes`, `notifications`, `admin`), registered in `AppModule`. No business
  logic yet — each phase in `docs/architecture.md` §9 fills in its module(s).

## Known gap between the two approved docs

`docs/architecture.md` §5.1 describes `MockSmsProvider` as writing to an `sms_log` table, but
`docs/erd.md` (the schema source of truth) has no such table. `MockSmsProvider` currently logs to the
server console and an in-memory buffer instead of inventing an unapproved table — worth reconciling
before the Users phase builds `auth` against this for real.

## Effect of the blocked Prisma download on this scaffold

Until `prisma generate` is run somewhere with network access, `@prisma/client`'s generated exports don't
exist, so `pnpm typecheck` / `pnpm build` / `pnpm test` here all fail in exactly one, well-understood way:
`PrismaService`, `HealthController` (its readiness check) and `MockNotificationChannel` — the only three
files that import the generated client — report "has no exported member 'PrismaClient'" and similar. Every
other file (all provider interfaces/mocks, config, module stubs, main.ts/app.module.ts wiring) typechecks,
lints, and the two `*.spec.ts` suites that don't touch Prisma (`geo.provider.spec.ts`,
`mock-payment-gateway.provider.spec.ts`, 9 tests) pass. This resolves itself automatically — no code change
needed — the moment `prisma generate` runs with real network access (CI has this; see `.github/workflows/ci.yml`).

## Migrations

No migration files are committed yet (`prisma/migrations/` doesn't exist). The environment this scaffold
was built in has no network access to `binaries.prisma.sh` (Prisma's engine-binary host), so
`prisma generate`/`migrate dev` could never actually be run here to produce one — `prisma validate` even
failed with a 403 trying to download the schema-engine binary. Run this once, anywhere with normal
internet access (your machine, or CI — see `.github/workflows/ci.yml`, which currently uses `prisma db
push` as a stand-in until this exists):

```
pnpm --filter @farmer-to-retailer/api prisma:migrate:dev -- --name init
```

That commits an initial migration reviewable in a PR, matching ADR-0001's reasoning for choosing Prisma
in the first place ("clean, reviewable SQL migration files ... matters for a money-handling schema").

## Running locally

```
pnpm --filter @farmer-to-retailer/api prisma:generate   # needs network access to binaries.prisma.sh
pnpm --filter @farmer-to-retailer/api prisma:migrate:dev
pnpm --filter @farmer-to-retailer/api start:dev
```

Needs a local Postgres reachable at `DATABASE_URL` (see `.env.example`) — every external provider is
mocked, so nothing else is required to run the app end-to-end.
