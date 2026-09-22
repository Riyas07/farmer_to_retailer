# System Architecture — Farmer-to-Retailer B2B Marketplace

Status: **Proposal — awaiting approval**
Owner: Mohammed Riyas
Last updated: 2026-09-22

## 1. What this system is

A B2B marketplace connecting **farmers** (sellers of produce) with **retailers** (buyers, e.g. kirana stores, small
wholesalers) operating in India. The platform is a **facilitator, not a merchant**:

- It never takes ownership of goods.
- It earns revenue via a **commission** on completed transactions, computed and enforced server-side.
- Payment is collected from the retailer through a payment gateway, held by the platform, and **paid out to the
  farmer (minus commission) only after pickup is confirmed by both parties** — this gives the marketplace an
  escrow-like trust mechanism without needing to run logistics.
- Fulfilment starts as **pickup-only** (farmer's location or an agreed point). Third-party delivery is an
  interface we design for but do not build in V1.

V1 scope (per current direction): **responsive web app**, not native mobile. Two customer-facing surfaces (farmer,
retailer) plus an internal admin dashboard, all backed by one NestJS API.

## 2. Design principles

1. **Modular monolith, not microservices.** One deployable backend service, organized into strongly-bounded
   modules with explicit interfaces between them. This is a small team / early-stage product — the operational
   cost of microservices (service discovery, distributed transactions, N deploy pipelines) isn't worth it yet.
   Module boundaries are drawn so that any module *could* be extracted into its own service later without a
   rewrite (no module reaches into another module's database tables directly — only through its service class).
2. **Server-side source of truth for money.** Commission rates, commission amounts, order totals and payout
   amounts are always computed and stored on the server at the moment they're locked in (e.g. at order
   confirmation). Clients never send a price/commission the server trusts blindly.
3. **Pluggable providers everywhere external.** SMS/OTP delivery, payment gateway, file storage, maps/geocoding,
   and push/notification delivery are each defined as a small TypeScript interface with a **Mock implementation**
   used in dev/MVP, so the system is fully runnable and testable without any real vendor account. Swapping in
   Razorpay/Cashfree/MSG91/Firebase/S3 later is a matter of writing one adapter class and changing config — no
   changes to business logic.
4. **Explicit state machines for anything with a lifecycle.** Negotiations and Orders are modeled as finite state
   machines with an explicit transition table, validated server-side. No status field is ever set by ad-hoc
   string assignment.
5. **Lean over complete.** We are not building slab-based tax engines, multi-warehouse inventory, or ML-based
   matching in V1. The matching engine is a scored filter/sort, not a recommender system. See `docs/decisions/`
   for the specific things we're deliberately deferring.

## 3. High-level component diagram

```mermaid
flowchart TB
    subgraph Clients
        WEB["Web App (React)\nFarmer + Retailer roles"]
        ADMIN["Admin Dashboard (React)"]
    end

    subgraph AWS
        CF["CloudFront + S3\n(static hosting for WEB/ADMIN)"]
        ALB["ALB"]
        API["NestJS API\n(modular monolith, ECS Fargate)"]
        RDS[("PostgreSQL - RDS")]
        S3IMG[("S3 - listing images, docs")]
    end

    subgraph External["External providers (pluggable, mocked for V1)"]
        SMS["SMS/OTP provider\n(MSG91 / Twilio)"]
        PAY["Payment gateway\n(Razorpay / Cashfree)"]
        MAPS["Maps/geocoding\n(Google Maps)"]
        PUSH["Push/notifications\n(Firebase, email)"]
    end

    WEB -->|HTTPS| CF --> ALB
    ADMIN -->|HTTPS| CF
    ALB --> API
    API --> RDS
    API --> S3IMG
    API -.provider interface.-> SMS
    API -.provider interface.-> PAY
    API -.provider interface.-> MAPS
    API -.provider interface.-> PUSH
```

## 4. Backend module map

Each module owns its own database tables and exposes a service-layer API to other modules — no cross-module raw
SQL/ORM queries.

| Module | Responsibility |
|---|---|
| `auth` | OTP request/verify, JWT issuance & refresh, role guards, session/device tracking |
| `users` | Core `User` identity, role (`FARMER` \| `RETAILER` \| `ADMIN`), profile completeness/KYC status |
| `farmer-profile` | Farmer-specific data: farm location, bank/UPI payout details, verification status |
| `retailer-profile` | Retailer-specific data: business name, business location, GSTIN (optional at MVP) |
| `catalog` | Produce categories, units of measure, listings (crop, quantity, price/unit, quality grade, images, availability window) |
| `matching` | Stateless query/scoring service: given a retailer's filters, rank active listings (distance, price, freshness) |
| `negotiation` | Offer / counter-offer thread on a listing between one farmer and one retailer; negotiation state machine |
| `orders` | Order creation from an accepted negotiation; order state machine; pickup scheduling & confirmation |
| `commission` | Commission rule configuration (admin-managed); computes & snapshots commission on order confirmation; commission ledger |
| `payments` | Payment intent creation, gateway webhook handling, payment status; payout initiation to farmer via provider interface |
| `disputes` | Raise/track/resolve disputes tied to an order; resolution actions (refund, partial refund, release, reject) |
| `notifications` | Domain-event listener → fan-out to SMS/push/email via provider interface; per-user notification log |
| `admin` | Cross-module read/write APIs for the admin dashboard: user verification, listing moderation, commission config, dispute queue, platform metrics |

Modules communicate either via direct service injection (synchronous, in-process — e.g. `orders` calling
`commission.calculateFor(order)`) or via an in-process **domain event bus** (NestJS `EventEmitter2`) for anything
that should stay decoupled — notifications is the main consumer of events (`OfferReceived`, `OrderConfirmed`,
`PaymentCaptured`, `PickupConfirmed`, `DisputeRaised`, `PayoutProcessed`, etc.). This event bus is the seam where
a future extraction into a real message queue (SQS/SNS) would happen, without touching the publishers.

## 5. Provider interfaces (pluggable)

All defined in `apps/api/src/providers/*` as TypeScript interfaces with DI tokens, so NestJS can bind a different
implementation per environment via config, with zero call-site changes.

```ts
interface SmsProvider {
  sendOtp(phoneE164: string, otp: string): Promise<void>;
}

interface PaymentGatewayProvider {
  createPaymentIntent(order: OrderPaymentInput): Promise<PaymentIntentResult>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  parseWebhookEvent(rawBody: Buffer): PaymentWebhookEvent;
  initiatePayout(payout: PayoutInput): Promise<PayoutResult>;
}

interface StorageProvider {
  getUploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }>;
  delete(key: string): Promise<void>;
}

interface GeoProvider {
  // MVP: haversine distance from stored lat/lng, no external call needed.
  // Real Maps use (geocoding a free-text address, autocomplete) is opt-in and deferred.
  distanceKm(a: LatLng, b: LatLng): number;
  geocode?(address: string): Promise<LatLng>;
}

interface NotificationChannel {
  // one per channel: SmsChannel, PushChannel, EmailChannel — all implement this
  send(userId: string, template: NotificationTemplate, data: Record<string, unknown>): Promise<void>;
}
```

V1 bindings: `MockSmsProvider` (writes OTP to a `sms_log` table + server console — nothing sent), `MockPaymentGatewayProvider` (simulates intent creation and lets a test endpoint "confirm" payment, simulates payouts as instantly `SETTLED`), `S3StorageProvider` (real — S3 is cheap and gives us real pre-signed upload URLs from day one, no reason to mock), `GeoProvider` with haversine only (no Maps API key needed for V1), `MockNotificationChannel` (logs to a table, surfaced in admin for now instead of an actual push/SMS/email send).

## 6. Frontend

- **`apps/web`** — one React + TypeScript app for both Farmer and Retailer. They share almost all primitives
  (auth, listing browse, negotiation thread, order tracking) and diverge only in a handful of screens (farmer:
  "my listings", "orders to fulfil"; retailer: "browse/search", "orders to receive"). Role-based routing after
  OTP login, shared component library, single deploy. Kept as one app deliberately — see ADR-0003.
- **`apps/admin`** — separate, smaller React app for internal ops/admin users. Kept separate from `apps/web` so
  it can be deployed to a distinct URL/subdomain, restricted by IP or SSO later, and never ships admin-only code
  to public bundles.
- **`packages/shared-types`** — DTOs, enums (order status, roles, etc.) generated/shared between `apps/api` and
  both frontends so the state machine and API contracts can't silently drift between backend and frontend.

## 7. Deployment topology (AWS)

Kept intentionally small for V1 — this is meant to run cheaply and simply, not to pre-optimize for scale we
don't have yet:

- **API**: single ECS Fargate service (1–2 tasks) behind an Application Load Balancer. Stateless — horizontal
  scale is just "add tasks" when needed.
- **Database**: RDS PostgreSQL, single instance (Multi-AZ can be turned on later without app changes).
- **Object storage**: S3 bucket for listing images and any dispute evidence uploads, served via CloudFront.
- **Frontends**: static builds of `apps/web` and `apps/admin`, each an S3 bucket + CloudFront distribution.
- **Secrets/config**: AWS Secrets Manager / SSM Parameter Store, injected as ECS task env vars.
- **CI/CD**: GitHub Actions — lint/test/build on PR, deploy to a single `staging` environment on merge to `main`
  (production promotion is a manual follow-up once we're past MVP validation).

No Kubernetes, no service mesh, no multi-region — all explicitly deferred.

## 8. Repo layout

```
farmer_to_retailer/
  apps/
    api/               # NestJS backend (modular monolith)
    web/               # React app — farmer + retailer
    admin/             # React app — admin/ops
  packages/
    shared-types/       # DTOs & enums shared across api/web/admin
  docs/
    architecture.md      # this file
    erd.md                # data model
    api-spec.md            # REST endpoint catalogue + openapi.yaml
    order-state-machine.md # negotiation & order lifecycles
    decisions/             # ADRs for things worth a deliberate call
  .github/workflows/        # CI
```

## 9. Build phases (as requested)

1. **Foundation** — repo/tooling, CI, NestJS skeleton, Postgres + migrations, config/env, provider interface
   scaffolding with mocks.
2. **Users** — OTP auth, roles, farmer/retailer profiles, admin user verification.
3. **Marketplace** — categories, listings, image upload, search/matching.
4. **Negotiation** — offer/counter-offer thread, negotiation state machine.
5. **Orders** — order creation from accepted negotiation, order state machine, pickup scheduling/confirmation.
6. **Payments** — commission engine, payment intents (mock gateway), payout on pickup confirmation.
7. **Disputes** — raise/track/resolve, refund/adjustment actions.
8. **Notifications** — domain events → notification log (mock channel), user-visible notification center.
9. **Admin dashboards** — verification queue, listing moderation, commission config, dispute queue, metrics.

Each phase should leave the system in a demoable state end-to-end (even if later phases are stubbed), rather than
building all backend before any frontend or vice versa.
