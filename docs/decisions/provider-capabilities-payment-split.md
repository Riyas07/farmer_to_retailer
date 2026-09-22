# Payment provider capability research — Razorpay Route vs. Cashfree Easy Split

Status: **Research — read before implementing `payments`/`payouts`**

This document exists because ADR-0005 (gateway marketplace/split payments with a held transfer, released after a
pickup-confirmation hold window) was originally written from general knowledge of how these products work, not
from a documentation review. This is that review. Every claim below is marked **CONFIRMED** (sourced from
official docs, with a link) or **UNCONFIRMED** (not found in the docs I could access, or genuinely ambiguous —
needs a direct conversation with the provider's solutions/sales engineering team before we build against it).
Nothing here should be treated as more certain than its tag says.

**Bottom line up front**: the 48-hour default hold window survives this review — both providers comfortably
support holding funds that long. What *doesn't* survive unchanged is the mechanics: releasing a hold is not the
same instant as money landing in the farmer's bank (both providers), Cashfree caps how long a hold can run and
won't let it be extended past a ceiling set at creation time, and Cashfree's reversal/reduction story is
meaningfully less documented than Razorpay's. Details below; the "What changes in our design" section at the
end is the actionable part.

## 1. Linked/vendor account onboarding

| | Razorpay Route (Linked Accounts) | Cashfree Easy Split (Vendors) |
|---|---|---|
| KYC inputs | Not found in the pages I could access for Route specifically — general Razorpay account KYC exists but I did not confirm the Linked-Account-specific document list. **UNCONFIRMED** | PAN/GST/CIN/passport/UIDAI/driving licence/voter ID plus bank account (account number, holder name, IFSC) or UPI VPA. **CONFIRMED** — [Create vendor](https://www.cashfree.com/docs/api-reference/payments/previous/v2023-08-01/split/vendors/create) |
| Activation delay before first payout | Not found. **UNCONFIRMED** | Vendor enters an `IN_BENE_CREATION` status on creation, implying a processing step, but the exact turnaround time and whether a vendor can receive a split while in this status are not documented in what I found. **UNCONFIRMED** — same source as above |

**What this means for us**: `farmer_profiles.gateway_linked_account_status` (`NOT_STARTED`/`PENDING`/`ACTIVE`/`REJECTED`)
already anticipates this needing a wait state — good — but we don't yet know how long "PENDING" typically lasts
for either provider, or whether a farmer can be *negotiating* while pending (should be fine — only *order
confirmation* needs an ACTIVE account) but not receive a payout while pending. **Action before Foundation
phase**: get this confirmed directly from whichever provider we pick, ideally with a sandbox account, since it's
the difference between "farmer gets paid same-day" and "farmer waits a week," which is a real product-quality
question, not just an engineering one.

## 2. Creating the hold

**Razorpay** — a transfer to a linked account is created with `on_hold: true` and an optional
`on_hold_until` (Unix timestamp). If `on_hold_until` is omitted, the hold is indefinite until explicitly
released. **CONFIRMED** — [Modify Settlement Hold for Transfers](https://razorpay.com/docs/api/payments/route/modify-settlement-hold/)
(the modify-hold page documents the same on_hold/on_hold_until shape used at creation). No maximum hold duration
is stated anywhere I found.

**Cashfree** — two independent knobs, easy to conflate:
1. **When the split itself is created**: either attached at order creation, or created via a separate Split API
   call after the payment-success webhook, which must happen within a **default 2-day window**. **CONFIRMED** —
   [Split After Payment Success](https://www.cashfree.com/docs/payments/split/features)
2. **When the vendor actually gets paid** (the real hold mechanism): a per-order-per-vendor
   `settlementEligibilityDate`, settable via API, deferring settlement independently of when the split was
   created. Maximum deferred settlement is **45 days from the transaction date**, after which funds release
   **automatically** — you cannot hold longer than 45 days. **CONFIRMED** —
   [Easy Split FAQs](https://www.cashfree.com/docs/help/easy-split/faqs/faqs)

## 3. Releasing / changing the hold

**Razorpay** — `PATCH /v1/transfers/:id` with `on_hold: false` releases immediately; the linked account is then
settled "by the next working day" — release is not instantaneous. `on_hold_until` can also be updated to extend
or shorten the hold, with no stated limit on how many times or by how much. **CONFIRMED** —
[Modify Settlement Hold for Transfers](https://razorpay.com/docs/api/payments/route/modify-settlement-hold/)

**Cashfree** — the `settlementEligibilityDate` can be **pulled earlier** at any time, but the docs explicitly
state it **cannot be pushed later than the `max_eligibity_date`** established when the hold was first
configured: *"Settlement eligibility cannot be beyond max_eligibity_date. Provide an earlier date."*
**CONFIRMED** — [Defer Settlement (vendor level)](https://www.cashfree.com/docs/payments/split/settlements/delay/vendor-level)

**This is the single biggest asymmetry between the two providers for our use case.** Razorpay lets us hold
indefinitely and decide the release moment whenever we're ready. Cashfree requires us to commit to an *outer
bound* up front and only ever move the date earlier — if a dispute needs more time than we originally budgeted,
Cashfree has no way to grant it beyond whatever ceiling we set at creation, and the 45-day hard cap means "hold
until resolved, however long that takes" is not actually available on Cashfree at all.

## 4. Reversal / reduction (dispute resolution against held funds)

**Razorpay** — a dedicated reversal API supports full reversal (omit `amount`) or partial reversal (specify
`amount`), and multiple reversals can be created against one transfer id (so incremental partial reductions are
possible). Minimum reversible amount is ₹1. The reversal debits the *linked account's balance* and credits the
platform's balance — **which requires the linked account to still hold sufficient balance**, i.e., this works
against funds sitting in the linked account's Razorpay-side balance, not against money that has already left
Razorpay for the farmer's actual bank. **CONFIRMED (mechanism)** —
[Reverse a Transfer](https://razorpay.com/docs/api/payments/route/reverse-a-transfer/). **UNCONFIRMED**: whether
a reversal is still possible after the linked account's *own* settlement schedule has already paid the balance
out to the farmer's real bank account — the docs I accessed don't say, and this is exactly the scenario a
late-arriving dispute could hit.

**Cashfree** — no dedicated "reverse a split" or "reduce a split amount" API was found in the Overview, Features,
or Scenarios pages. What exists is a general **"Transfer Vendor Balance"** tool for manual credit/debit between
vendor and merchant accounts, "contingent on sufficient account balance" — this *could* be used as a manual
reversal mechanism, but it isn't documented as being tied to a specific order/split, and its suitability for our
dispute-resolution flow is **UNCONFIRMED**. **This is a real gap, not an oversight in my reading** — I searched
specifically for reversal/cancellation content and came up empty across the FAQ, Features, and Scenarios pages.

## 5. Refund interaction

**Razorpay** — refunding the original payment does **not** automatically reverse the linked-account transfer.
`reverse_all: true` on the refund call will recover the amount from the linked account, but **only when the
payment was transferred to a single linked account** — for a payment split across multiple linked accounts, the
transfer reversal must be done manually per account. **CONFIRMED** —
[Refund Payments and Reverse Transfer](https://razorpay.com/docs/api/payments/route/refund-payments-and-reverse-transfer/).
(Not an issue for us today — one order always has exactly one farmer/one linked account — but worth remembering
if a future version ever splits one order's proceeds across multiple recipients.)

**Cashfree** — "Refund Before Split" is simple (comes from the merchant's own pending settlement, since the
vendor was never allocated anything yet). "Refund After Split" apportions the refund across merchant and vendor
settlement accounts proportional to the original split. **CONFIRMED** — [Easy Split Features](https://www.cashfree.com/docs/payments/split/features).
Behavior once the vendor portion has already settled to their bank is **UNCONFIRMED**.

## 6. Settlement confirmation (release ≠ money landed)

**Razorpay** — a `settlement.processed` webhook fires "after Razorpay has successfully transferred funds to your
bank account" — a genuinely separate, later event from the transfer being released/taken off hold. **CONFIRMED**
— [Settlements Webhook Events](https://razorpay.com/docs/webhooks/settlements/). I was not able to retrieve the
full enumerated list of Route-specific transfer webhook events (e.g. an equivalent `transfer.processed` /
`transfer.failed`) from the pages my fetches returned — the page exists
([Route Webhook Events](https://razorpay.com/docs/webhooks/payloads/route/)) but the actual event table didn't
come through in what I could read. **UNCONFIRMED — needs a direct look at the full page or API reference before
we build the webhook handler.**

**Cashfree** — the product page advertises "webhook-based reconciliation" for transaction status, refunds, and
settlements, but I did not find the specific event names in the pages I accessed. **UNCONFIRMED**.

**Why this matters regardless of the exact event names**: both providers confirm that "transfer released" and
"money actually in the farmer's bank account" are two different moments with a gap between them (Razorpay says
explicitly "by the next working day"). Our original state-machine draft treated pickup-confirmation-hold-elapsed
→ release → `COMPLETED` as one atomic step. It shouldn't be. See below.

## 7. Comparison summary

| Capability | Razorpay Route | Cashfree Easy Split |
|---|---|---|
| Max hold duration | None stated (indefinite) | **45 days hard cap, auto-releases after** |
| Extending a hold once set | Yes, no stated limit | **No — can only pull the date earlier than the original ceiling** |
| Release timing | Immediate trigger; "next working day" to actually settle | Not documented in what I found; assume similarly non-instant |
| Full reversal | Documented API | Not documented; manual balance-transfer tool exists but untied to a specific split |
| Partial reversal | Documented API, multiple reversals allowed | Not documented |
| Refund auto-reverses transfer | No — opt-in via `reverse_all`, single-linked-account only | Refund-after-split apportions automatically across merchant/vendor |
| Settlement confirmation webhook | `settlement.processed` confirmed to exist | Advertised, specific event names unconfirmed |

## 8. What changes in our design as a result

1. **Keep the 48-hour default hold window** — both providers support it comfortably. No change to the default.
2. **`COMPLETED` should require settlement *confirmation*, not just release being triggered.** Add a distinct
   `payouts.status = RELEASED` (release/on_hold=false triggered, or Cashfree eligibility date reached) vs.
   `SETTLED` (provider confirmed funds reached the linked/vendor account's bank) — `orders.status` only becomes
   `COMPLETED` on `SETTLED`, not on `RELEASED`. This is a real, provider-confirmed gap in the previous draft, not
   a hypothetical one.
3. **Add a `payouts.hold_ceiling_at` field.** For Cashfree, we must commit to an outer bound at split-creation
   time and can only pull it earlier — so we should set the ceiling generously (e.g., the 45-day maximum) at
   order-confirmation time, then *pull the eligibility date in* to `pickup_confirmed_at + hold window` once
   pickup actually happens, rather than trying to push a date out later (which the provider won't allow). For
   Razorpay this field is informational only (no real ceiling), but keeping it in the model means the same
   `orders`/`payouts` schema works for either provider without a conditional column.
4. **A dispute that drags past whatever ceiling was set (45 days, for Cashfree) needs an explicit operational
   answer**, not silent auto-release. At minimum: admin alerting well before the ceiling (e.g., at day 35), and
   a documented fallback (likely: manually settle the dispute one way or the other before the ceiling, since
   letting Cashfree auto-release out from under an open dispute is the one outcome we can't allow).
5. **Don't assume reversal works after the linked/vendor account's own settlement has paid the farmer's real
   bank.** Our hold-window design already keeps `DISPUTED` reachable only pre-`COMPLETED`, and with `COMPLETED`
   now gated on confirmed settlement rather than just release, this risk window narrows to "released but not yet
   provider-settled" — which should be short (Razorpay: about one business day) but is not zero. This residual
   risk is inherent to any hold-window design against these providers and should be named as a known, accepted
   risk rather than modeled away.
6. **Interface stays provider-neutral; adapters differ more than originally assumed.** `PaymentGatewayProvider`
   keeps the same shape (`createSplitPayment`, `releaseTransfer`, `reduceTransfer`, `reverseTransfer`,
   `refundPayment`), but a `holdCeiling` input is added to `createSplitPayment` so the Cashfree adapter has
   something to set as `max_eligibity_date`/`settlementEligibilityDate` at creation, while the Razorpay adapter
   can ignore it (or use it as an optional `on_hold_until`, since Razorpay has no real ceiling). The **mock**
   provider should simulate both providers' quirks — a two-phase `RELEASED`→`SETTLED` transition with a
   configurable delay, and a hold-ceiling that, if reached, auto-releases — so the state machine and admin
   alerting logic are exercised against the *harder* of the two behaviors before we ever touch a sandbox.

## 9. Open items that need a real provider conversation before Foundation-phase build (not just more searching)

- Linked/vendor account KYC document list and typical activation turnaround, for both providers.
- Whether a reversal (Razorpay) or a vendor-balance debit (Cashfree) still works once the linked/vendor
  account's own settlement has already paid out to the farmer's real bank.
- The full, current list of Route webhook events (I found `settlement.processed`; the Route-specific event table
  didn't come through in my fetches) and the equivalent for Cashfree Easy Split.
- Cashfree's actual mechanism, if any, for reversing or reducing an already-created split before its eligibility
  date — confirm this exists and how, or confirm it doesn't and we need the manual vendor-balance-transfer tool
  as the fallback (and get its exact semantics/limits).
- Given item 5 above (reversal risk narrows but doesn't vanish), whether either provider offers a way to keep
  funds in an explicitly reversible state slightly *past* our own release trigger, as extra safety margin.

We stay on `MockPaymentGatewayProvider` until these are answered — nothing here blocks Foundation-phase work on
`auth`, `users`, `catalog`, `negotiation`, or the rest of `orders` that doesn't depend on real payment gateway
specifics.
