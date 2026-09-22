# ADR-0005 — Payment model: gateway marketplace/split payments with held transfers

**Status**: Proposed (revised — supersedes the original "collect-then-payout" version of this ADR)

## Context
The platform takes a commission but never owns goods. There are two common ways to move money in that setup:

1. **Split/marketplace payments** (Razorpay Route, Cashfree Easy Split): the retailer pays into a single payment
   that is pre-configured, *at creation time*, to be split between the platform (commission) and the farmer's own
   linked sub-account (payout). The gateway — not the platform — is the entity holding and moving the money; the
   platform never has it sitting in its own operating bank account.
2. **Collect-then-payout**: the retailer's full payment is captured into the platform's own account; the platform
   separately initiates a payout to the farmer later, from its own funds, whenever it decides to.

## Decision
Use **gateway marketplace/split payments with held transfers** — option 1 — via the `PaymentGatewayProvider`
interface's `createSplitPayment` / `releaseTransfer` / `reverseTransfer` methods (see `docs/architecture.md` §5),
**not** collect-then-payout. The platform's own bank account is never the resting place for a retailer's payment,
at any point in the order lifecycle.

## Why this changed from the original decision
The original version of this ADR chose collect-then-payout specifically to make "payout only after pickup
confirmation" possible, and treated split payments as settling *instantly* — which would indeed have defeated
that trust mechanism. That framing was incomplete: both Razorpay Route and Cashfree's split-payment products
support creating a transfer to the linked account **on hold** (`on_hold: true` at creation), which sits unsettled
until the platform explicitly releases it via an API call — or reverses/reduces it. That means we can get the
regulatory and risk benefits of split payments *and* keep pickup-gated payout timing; there was no real tradeoff
being forced, just an incomplete read of what the split-payment products support.

The collect-then-payout model also has a real downside the original ADR underweighted: it means the platform's
own bank account is, for a window, holding money that legally/operationally belongs to a transaction between two
other parties. In India this is exactly what payment aggregator/marketplace regulation (RBI's PA-PG framework)
is designed to prevent outside of a properly authorized nodal/escrow account — a platform that "never owns
goods" shouldn't casually end up owning the cash flow either. Using the gateway's own marketplace/split product
is the standard way small/early platforms get compliant escrow behavior without standing up a nodal account
themselves.

## How it works
1. **Farmer onboarding (new prerequisite)**: before a farmer can receive a payout, they complete the gateway's
   linked-account KYC (`farmer_profiles.gateway_linked_account_id` / `gateway_linked_account_status`). A farmer
   can still list produce and negotiate without this — it's only required by the time an order needs to be
   confirmed, i.e., before payment. `POST /farmer/payout-account` (see `api-spec.md`) kicks this off.
2. **At `PENDING_PAYMENT`** (order created from an accepted negotiation): the platform creates the gateway order
   with a `transfers[]` spec — one entry routing `payout_amount` to the farmer's linked account, `on_hold: true`.
   Commission is implicitly the remainder retained by the platform's own account under the same payment — no
   separate transfer needed for it.
3. **On payment capture** → `CONFIRMED`. The full amount has moved from retailer to the gateway's settlement
   flow; the farmer's `payout_amount` share exists as a held, not-yet-settled transfer. It is not sitting in the
   platform's bank account and it is not yet in the farmer's.
4. **On pickup confirmation** → the order does **not** immediately release the transfer. A hold window opens
   (see `order-state-machine.md` — this is also the fix for the pickup/payout/dispute contradiction below) during
   which the transfer can still be reduced or reversed if a dispute is raised.
5. **Hold window elapses with no open dispute** → system calls the gateway to release the transfer. Funds move
   to the farmer's linked account (and from there to their bank/UPI on the gateway's own settlement schedule).
   Order becomes `COMPLETED`.
6. **Dispute raised during the hold window** → transfer is reduced (partial refund) or reversed (full refund)
   via the gateway's API *before* release — always possible, because release hasn't happened yet.

## Alternatives considered
- **Collect-then-payout** (the original decision) — rejected per the above: unnecessary regulatory exposure for
  no actual gain, once "on-hold transfers" are accounted for correctly.
- **Instant (non-held) split payments** — rejected: would pay the farmer before pickup is even confirmed,
  removing the trust mechanism entirely.

## Consequences
- Farmers need gateway-side KYC before their first payout, not just our own verification — real onboarding
  friction, but it's the gateway's standard onboarding, not something we're building ourselves.
- `MockPaymentGatewayProvider` must simulate: linked account creation/status, split-payment creation with
  `on_hold` transfers, an explicit release call, and a reversal/reduction call — so the state machine and hold
  window logic are fully testable without a real gateway account.
- The platform's own settlement account only ever receives its commission share — never the farmer's portion —
  which simplifies our own accounting and removes us from the custody chain for the farmer's money.
- Reconciliation now has two gateway-side references to track per order: the payment's settlement (commission
  landing in our account) and the transfer's settlement (payout landing in the farmer's) — see the strengthened
  reconciliation fields on `payments`/`payouts` in `docs/erd.md`.
