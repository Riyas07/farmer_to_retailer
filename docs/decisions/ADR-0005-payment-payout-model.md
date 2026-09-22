# ADR-0005 — Payment model: gateway marketplace/split payments with held transfers

**Status**: Proposed (revised twice — supersedes the original "collect-then-payout" version, and the mechanics
below are now corrected against real provider documentation; see
[`docs/decisions/provider-capabilities-payment-split.md`](./provider-capabilities-payment-split.md) for the full
research with citations and a list of items still needing direct provider confirmation before build)

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
5. **Hold window elapses with no open dispute** → system calls the gateway to release the transfer
   (`payouts.status: ON_HOLD → RELEASED`). This is **not** the same moment as the farmer being paid — both
   providers confirm a separate, later settlement step (Razorpay: release is followed by settlement "by the next
   working day"; see the research doc). `orders.status` becomes `COMPLETED` only once the gateway confirms
   settlement (`payouts.status: RELEASED → SETTLED`), not merely on release being triggered — this correction
   comes directly from the provider research and narrows (but doesn't eliminate) the residual window where a
   dispute could theoretically race a release.
6. **Dispute raised during the hold window** → transfer is reduced (partial refund) or reversed (full refund)
   via the gateway's API *before* release. Razorpay's reversal API is confirmed to support this; Cashfree's
   equivalent is **not confirmed** in current docs — see the research doc §4 and §9.
7. **Hold ceiling (Cashfree-specific constraint)**: Cashfree caps how long a hold can run (45 days) and, once
   set, only lets that date move *earlier*, never later. So for Cashfree specifically, we set a generous ceiling
   (`payouts.hold_ceiling_at`) at split-creation time and pull the actual release date *in* once pickup is
   confirmed, rather than trying to extend a shorter window later. Razorpay has no such ceiling. See the
   research doc §3 and §8.

## Alternatives considered
- **Collect-then-payout** (the original decision) — rejected per the above: unnecessary regulatory exposure for
  no actual gain, once "on-hold transfers" are accounted for correctly.
- **Instant (non-held) split payments** — rejected: would pay the farmer before pickup is even confirmed,
  removing the trust mechanism entirely.

## Consequences
- Farmers need gateway-side KYC before their first payout, not just our own verification — real onboarding
  friction, but it's the gateway's standard onboarding, not something we're building ourselves. Exact turnaround
  time is an open item — see the research doc §1/§9.
- `MockPaymentGatewayProvider` must simulate the *harder* of the two providers' behavior, not the easier one:
  linked/vendor account creation with a configurable activation delay, split-payment creation with a hold
  ceiling, a two-phase `RELEASED` → `SETTLED` transition with a configurable settlement lag, and
  reversal/reduction calls that can be made to fail (to exercise our error handling) — so the state machine, the
  hold-ceiling-approaching alert, and the settlement-confirmation gate are all fully testable before a real
  gateway account exists.
- The platform's own settlement account only ever receives its commission share — never the farmer's portion —
  which simplifies our own accounting and removes us from the custody chain for the farmer's money.
- Reconciliation now has two gateway-side references to track per order: the payment's settlement (commission
  landing in our account) and the transfer's settlement (payout landing in the farmer's) — see the strengthened
  reconciliation fields on `payments`/`payouts` in `docs/erd.md`.
- We are **not** picking Razorpay vs. Cashfree yet. The research doc shows real, material differences between
  them (hold ceiling, reversal API maturity) — that choice should wait until the open items in its §9 are
  answered directly by each provider, ideally with a sandbox account for each.
