# Farmer ⇄ Retailer B2B Marketplace

A commission-based B2B marketplace connecting farmers and retailers across India. The platform never owns goods
— it facilitates negotiation, order tracking and pickup, and takes a server-computed commission on completed
orders. V1 is pickup-only, web-based (React), backed by a NestJS modular monolith on PostgreSQL.

## Status: design phase — no application code yet

This repository currently contains the **architecture proposal, data model, API specification and order state
machine** for review. Implementation starts only after these are approved. See:

- [`docs/architecture.md`](./docs/architecture.md) — system design, module boundaries, tech stack, deployment
- [`docs/erd.md`](./docs/erd.md) — data model (ERD + table definitions)
- [`docs/api-spec.md`](./docs/api-spec.md) — REST API catalogue (+ [`docs/openapi.yaml`](./docs/openapi.yaml) starter)
- [`docs/order-state-machine.md`](./docs/order-state-machine.md) — negotiation & order lifecycles
- [`docs/decisions/`](./docs/decisions/) — ADRs for the specific calls worth a deliberate decision, including
  [`provider-capabilities-payment-split.md`](./docs/decisions/provider-capabilities-payment-split.md) — sourced
  research on what Razorpay Route and Cashfree Easy Split actually support (hold/release/reversal/refund/
  webhooks), with open items flagged for direct provider confirmation before the payment gateway is built

## Planned repo layout

```
apps/
  api/      NestJS backend (modular monolith)
  web/      React app — farmer + retailer
  admin/    React app — internal admin/ops
packages/
  shared-types/   DTOs & enums shared across api/web/admin
docs/
  ...             (see above)
```

## Build phases

1. Foundation — repo/tooling, CI, NestJS skeleton, Postgres + migrations, provider interfaces with mocks
2. Users — OTP auth, roles, farmer/retailer profiles, admin verification
3. Marketplace — categories, listings, image upload, search/matching
4. Negotiation — offer/counter-offer thread, negotiation state machine
5. Orders — order creation, order state machine, pickup scheduling/confirmation
6. Payments — commission engine; split-payment creation with a held (`on_hold`) transfer to the farmer's linked
   account (mock gateway); the held transfer is released only after pickup is confirmed *and* a hold window
   passes with no open dispute, and the order isn't `COMPLETED` until the gateway separately confirms settlement
   — see `docs/order-state-machine.md` and `docs/decisions/ADR-0005-payment-payout-model.md`
7. Disputes — raise/track/resolve, refund/adjustment actions
8. Notifications — domain events → notification log, in-app notification center
9. Admin dashboards — verification queue, listing moderation, commission config, dispute queue, metrics

Third-party integrations (SMS/OTP, payment gateway, maps, push notifications) are built behind pluggable provider
interfaces with mock implementations, so every phase is runnable and testable without any real vendor account —
see `docs/architecture.md` §5.
