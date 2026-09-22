# ADR-0004 — Cancellation/refund policy is an admin judgment call in V1, not a rules engine

**Status**: Proposed

## Context
The order state machine (`docs/order-state-machine.md`) supports cancellation at several pre-pickup states and
dispute resolution with full/partial refunds. What it deliberately does *not* define is a formula for "how much
penalty, if any, applies when X cancels at state Y."

## Decision
V1 ships **no automatic penalty/refund-percentage engine**. Every cancellation after `CONFIRMED` (i.e. after
money has been captured) and every dispute resolution is a manual admin action: the admin looks at the order and
picks `NO_ACTION` / `REFUND` / `PARTIAL_REFUND` with a free-text `refundAmount` and notes. Cancellations *before*
`CONFIRMED` (no payment captured yet) are always free/automatic.

## Why
Real-world penalty policy for a farmer no-show vs. a retailer no-show vs. a quality dispute is a business
decision that doesn't exist yet — encoding a wrong policy into a rules engine is more expensive to undo than
starting with a human in the loop. The `disputes` and `orders` modules are built so this *can* become an
automatic rules engine later (the resolution action and amount are already structured, admin-entered data) —
we're just not building the rule evaluator until there's evidence of what the rules should be.

## Alternatives considered
- **Hardcode a simple policy now** (e.g. "50% penalty on retailer no-show") — rejected: guessing the number is
  worse than not having one, and it's one more thing to get subtly wrong before we've seen real transactions.

## Consequences
- Every dispute needs an admin to look at it — fine at MVP volume, would need revisiting well before this
  becomes a bottleneck (i.e. before dispute volume is more than an admin can review same-day).
- `docs/admin` metrics should include "open disputes older than 24h" so this doesn't silently pile up.
- **This interacts with the payout hold window (ADR-0005 / `order-state-machine.md`).** A dispute opened on an
  order in `PICKED_UP` pauses that order's scheduled transfer release, so there's no hard deadline forcing a
  same-day resolution *for that specific order*. But once an admin resolves it back to `RESOLVED_RESUME`, the
  hold window restarts — so a resolved-but-then-reopened dispute, or a genuinely slow admin, can still push an
  order's effective payout date out. Worth watching once real dispute volume shows up, but not something V1
  needs to solve pre-emptively.
