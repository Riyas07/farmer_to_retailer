# Architecture Decision Records

Short records of the calls made while drafting the proposal that are genuinely debatable — flag any of these in
review if you'd rather go a different way; everything here is cheap to change before implementation starts.

- [ADR-0001 — ORM: Prisma over TypeORM](./ADR-0001-orm-choice.md)
- [ADR-0002 — Monorepo tooling: npm/pnpm workspaces, no Turborepo yet](./ADR-0002-monorepo-tooling.md)
- [ADR-0003 — One web app for farmer + retailer, separate admin app](./ADR-0003-frontend-app-split.md)
- [ADR-0004 — Cancellation/refund policy is an admin judgment call in V1, not a rules engine](./ADR-0004-cancellation-refund-policy.md)
- [ADR-0005 — Payment model: gateway marketplace/split payments with held transfers, released only after a
  pickup-confirmation hold window *and* provider-confirmed settlement (no provider chosen yet between Razorpay
  Route and Cashfree Easy Split)](./ADR-0005-payment-payout-model.md)
- [ADR-0006 — Matching engine is a scored filter, not ML](./ADR-0006-matching-engine.md)
- [Provider capability research — Razorpay Route vs. Cashfree Easy Split](./provider-capabilities-payment-split.md)
  — sourced findings on hold/release/reversal/refund/webhook behavior, each tagged CONFIRMED or UNCONFIRMED, with
  open items flagged for a direct provider conversation before build. Not an ADR itself (no decision to record
  yet, and deliberately doesn't pick a provider) — ADR-0005's §"How it works" and §"Consequences" now rest on
  this doc's findings, in particular the hold-ceiling and release-vs-settlement points.
