# ADR-0005 — Payment model: platform-held collect-then-payout, not marketplace split payments

**Status**: Proposed

## Context
The platform takes a commission but never owns goods. There are two common ways to move money in that setup:

1. **Split/marketplace payments** (Razorpay Route, Cashfree Easy Split): the retailer's single payment is
   automatically split at the gateway level between the platform's account (commission) and the farmer's linked
   sub-account (payout) — normally *at the moment of payment*.
2. **Collect-then-payout**: the retailer's full payment is captured into the platform's own account; the
   platform separately initiates a payout to the farmer later, whenever it decides to (in our case, on pickup
   confirmation).

## Decision
Use **collect-then-payout** for V1, via the `PaymentGatewayProvider` interface's `initiatePayout` method (see
`docs/architecture.md` §5), not gateway-native split payments.

## Why
- Split-payment products require each farmer to be onboarded as a sub-merchant/linked account with the gateway
  (KYC with the gateway itself, not just with us) before they can receive anything — that's real onboarding
  friction for a farmer trying to list produce for the first time, and it's exactly the kind of setup cost a
  mocked-provider MVP shouldn't be blocked on.
- Collect-then-payout is also what makes the **pickup-confirmation-gates-payout** trust mechanism
  (`order-state-machine.md`) possible in the first place — with instant split payments, the farmer would be paid
  before pickup even happens, defeating the point.
- It's the strictly more general model: it works identically whether the eventual real provider supports split
  payments or not, and a MockPaymentGatewayProvider can simulate both "capture" and "payout" as two independent,
  clearly-timed events, which is exactly what we want to test the state machine against.

## Alternatives considered
- **Gateway split payments** — revisit once farmer volume is high enough that manual/API-driven payout
  processing (even if automated) becomes an operational bottleneck, and once a specific gateway's sub-merchant
  onboarding flow can be evaluated for how much farmer friction it actually adds.

## Consequences
- The platform's own bank account temporarily holds retailer payments between `CONFIRMED` and `PICKED_UP` —
  this needs basic reconciliation reporting in the admin dashboard (funds held vs. funds payable) from early on,
  even if it's just a query against `payments`/`payouts`, not a full ledger system.
- Payout timing is entirely in our control (good for the trust mechanism), but also means we own the operational
  responsibility of actually running payouts reliably — `payouts.status` and retry/alerting on `FAILED` payouts
  matters more here than it would with gateway-native splits.
