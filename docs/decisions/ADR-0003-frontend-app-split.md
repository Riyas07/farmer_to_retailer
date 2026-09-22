# ADR-0003 — One web app for farmer + retailer, separate admin app

**Status**: Proposed

## Context
Three distinct user experiences exist: farmer, retailer, admin/ops. We need to decide how many deployable
frontend apps that becomes.

## Decision
- **`apps/web`**: a single React app serving both farmers and retailers, with role-based routing/layouts after
  OTP login.
- **`apps/admin`**: a separate React app for internal ops/admin users.

## Why
- Farmers and retailers share almost the entire interaction surface — auth, browsing/creating listings vs.
  browsing to buy, the negotiation thread UI, the order timeline, notifications. Splitting them into two apps
  would mean duplicating that shared UI and shipping two builds for what's fundamentally one marketplace
  experience viewed from two sides.
- Admin is a genuinely different audience (internal team, not public signup) with different security needs
  (should be easy to put behind SSO/IP allowlisting later, should never leak admin-only routes/strings into a
  public bundle). Separating it now avoids a later, more painful split.

## Alternatives considered
- **Three separate apps** (farmer, retailer, admin) — maximizes isolation but means real duplication of shared
  components (or a fourth package to hold them), which is more scaffolding than a pre-revenue MVP needs.
- **One app for all three roles including admin** — rejected mainly for the security-segregation reason above.

## Consequences
- `apps/web` needs role-aware routing and at least two distinct top-level navigation shells (farmer vs.
  retailer), which is straightforward with a router + role check at the layout level.
- Shared UI primitives (buttons, forms, the listing card, the negotiation thread) should live somewhere
  reusable if `apps/admin` ever wants them — deferred until there's an actual second consumer of a component;
  not creating a `packages/ui` package speculatively.
