# API Specification — Farmer-to-Retailer Marketplace

Status: **Proposal — awaiting approval**

Base URL: `/api/v1`. All authenticated endpoints require `Authorization: Bearer <accessToken>`. All request/response
bodies are JSON. A machine-readable starter is at [`openapi.yaml`](./openapi.yaml) (core resources only — the
table below is the source of truth for full endpoint coverage).

Standard error shape for every 4xx/5xx:
```json
{ "statusCode": 400, "error": "VALIDATION_ERROR", "message": "quantity must be positive", "details": [] }
```

## Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/otp/request` | none | `{ phone, purpose: SIGNUP\|LOGIN, role? }` | `{ challengeId, expiresAt }` |
| POST | `/auth/otp/verify` | none | `{ challengeId, otp }` | `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | refresh token | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | bearer | — | `204` |

Rate limits: max 3 OTP requests per phone per 10 minutes; max 5 verify attempts per challenge before it's dead.
`purpose` here is strictly `SIGNUP`/`LOGIN` — this endpoint has no notion of pickup handover at all. The pickup
handover code is a completely separate mechanism under `/orders/:id/mark-ready` and `/orders/:id/pickup/confirm`
(see the Orders section) — verifying it can never yield an auth token, and these auth endpoints can never verify
a pickup code. See `docs/architecture.md` §5.1.

## Users / profiles

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/users/me` | bearer | — | user + role-specific profile |
| PATCH | `/farmer/profile` | bearer, role `FARMER` | partial `FarmerProfile` | updated profile |
| PATCH | `/retailer/profile` | bearer, role `RETAILER` | partial `RetailerProfile` | updated profile |
| GET | `/users/me/notifications` | bearer | query: `unreadOnly?` | `Notification[]` |
| PATCH | `/users/me/notifications/:id/read` | bearer | — | `204` |
| POST | `/farmer/payout-account` | bearer, `FARMER` | `{ ...gateway-required KYC fields }` | `{ linkedAccountId, status }` — starts gateway linked-account onboarding (see ADR-0005); required before this farmer's first order can be confirmed, not before they can list |
| GET | `/farmer/payout-account` | bearer, `FARMER` | — | `{ linkedAccountId, status }` |

## Catalog / listings

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/categories` | none | — | `Category[]` |
| GET | `/listings` | none (public browse) | query: `categoryId?, cropName?, minPrice?, maxPrice?, lat?, lng?, radiusKm?, minQuantity?, sort?(distance\|price\|newest), page?, pageSize?` | `{ items: Listing[], total, page }` — routed through the `matching` service. **Location privacy**: each `Listing` exposes `displayLat`/`displayLng` (coarse, ~1km) and `village`/`district` text only — `pickupAddress`/exact `pickupLat`/`pickupLng` are never included in this response, see `docs/erd.md` §3 |
| GET | `/listings/:id` | none | — | `Listing` (with images, farmer's public display name/village) — same coarse-location-only rule as above |
| POST | `/listings` | bearer, `FARMER` (verified) | `CreateListingDto` | `Listing` |
| PATCH | `/listings/:id` | bearer, owning `FARMER` | partial `UpdateListingDto` | `Listing` |
| DELETE | `/listings/:id` | bearer, owning `FARMER` | — | `204` (soft: `status = REMOVED`) |
| POST | `/listings/:id/images/upload-url` | bearer, owning `FARMER` | `{ contentType }` | `{ uploadUrl, publicUrl, s3Key }` (pre-signed S3 PUT) |
| POST | `/listings/:id/images` | bearer, owning `FARMER` | `{ s3Key, position? }` | `ListingImage` (confirms an upload) |
| GET | `/farmer/listings` | bearer, `FARMER` | query: `status?` | `Listing[]` (mine) |

## Negotiation

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/listings/:id/negotiations` | bearer, `RETAILER` | `{ pricePerUnit, quantity, message? }` | `Negotiation` |
| GET | `/negotiations` | bearer | query: `status?` | `Negotiation[]` (mine, either side) |
| GET | `/negotiations/:id` | bearer, participant | — | `Negotiation` with `offers: NegotiationOffer[]` — still coarse-location-only; exact pickup address isn't revealed until an order exists |
| POST | `/negotiations/:id/offers` | bearer, participant | `{ pricePerUnit, quantity, message? }` | `NegotiationOffer` |
| POST | `/negotiations/:id/accept` | bearer, participant | — | `Negotiation` (status `ACCEPTED`) → triggers order creation |
| POST | `/negotiations/:id/reject` | bearer, participant | `{ reason? }` | `Negotiation` |
| POST | `/negotiations/:id/cancel` | bearer, initiator | `{ reason? }` | `Negotiation` |

**Guard**: `accept` can only be called by the side that did *not* post the most recent offer (you can't accept
your own open offer).

## Orders

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/orders` | bearer | query: `status?, role?` | `Order[]` (mine, either side) |
| GET | `/orders/:id` | bearer, participant | — | `Order` (with `payment`, `payout` summaries). **This is the only place `pickupAddress`/exact `pickupLat`/`pickupLng` are ever returned, and only to this order's own farmer/retailer (or an admin)** |
| POST | `/orders/:id/schedule-pickup` | bearer, participant | `{ scheduledAt }` | `Order` (status `PICKUP_SCHEDULED`) |
| POST | `/orders/:id/mark-ready` | bearer, owning `FARMER` | — | `Order` (status `READY_FOR_PICKUP`) — server generates a **pickup handover code** (`pickup_handover_codes`, order-scoped — not the login OTP system, see `docs/architecture.md` §5.1) and sends it to the farmer only |
| POST | `/orders/:id/pickup/regenerate-code` | bearer, owning `FARMER` | — | `204` — invalidates the current handover code and issues a fresh one, e.g. if it expired or was lost |
| POST | `/orders/:id/pickup/confirm` | bearer, `RETAILER` | `{ code }` | `Order` (status `PICKED_UP`; `payoutReleaseAt` set to now + hold window) |
| POST | `/orders/:id/cancel` | bearer, participant or `ADMIN` | `{ reason }` | `Order` (status `CANCELLED`) — only valid before `CONFIRMED`→pickup states per the state machine; the held transfer is cancelled, never settled |

## Payments

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/orders/:id/payment-intent` | bearer, owning `RETAILER` | — | `{ provider, providerOrderId, clientPayload }` — creates the gateway's split-payment order with the farmer's `on_hold` transfer already configured for `payoutAmount` (see ADR-0005); `clientPayload` is what the frontend hands to the gateway's checkout SDK |
| GET | `/orders/:id/payment` | bearer, participant | — | `Payment` (includes reconciliation fields for admin; participant view omits internal reconciliation status) |
| GET | `/orders/:id/payout` | bearer, participant | — | `Payout` — the held-transfer record: `onHold`, `holdReleaseAt`, `holdCeilingAt`, `status` (`ON_HOLD`\|`RELEASED`\|`SETTLED`\|`REVERSED`\|`PARTIALLY_REVERSED`\|`FAILED`), and, once each happens, `releasedAt`/`settledAt`. **Note**: `released` and `settled` are genuinely separate events per provider research (`docs/decisions/provider-capabilities-payment-split.md`) — the order isn't `COMPLETED` until `settledAt` is set |
| POST | `/webhooks/payments/:provider` | **none** (HMAC signature verified from raw body) | raw gateway payload | `200` (always, per gateway convention) |

## Disputes

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/orders/:id/disputes` | bearer, participant | `{ category, description, evidenceS3Keys? }` | `Dispute` — only accepted while the order is in a pre-`COMPLETED` state and (if past `PICKED_UP`) before `payoutReleaseAt`; rejected with `409 DISPUTE_WINDOW_CLOSED` otherwise, since `COMPLETED` means the transfer has already, irreversibly, released (see `order-state-machine.md`) |
| GET | `/disputes` | bearer | query: `status?` | `Dispute[]` (mine, or all if `ADMIN`) |
| GET | `/disputes/:id` | bearer, participant or `ADMIN` | — | `Dispute` |
| POST | `/admin/disputes/:id/resolve` | bearer, `ADMIN` | `{ resolution: NO_ACTION\|REFUND\|PARTIAL_REFUND, refundAmount?, notes }` | `Dispute` + updated `Order` — `REFUND` reverses the held transfer and refunds the payment; `PARTIAL_REFUND` reduces the held transfer and partially refunds the payment; both act on funds still held pre-release, never a clawback |

## Admin

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/admin/users` | bearer, `ADMIN` | query: `role?, status?` | `User[]` |
| POST | `/admin/farmers/:id/verify` | bearer, `ADMIN` | `{ decision: APPROVE\|REJECT, notes? }` | `FarmerProfile` |
| POST | `/admin/retailers/:id/verify` | bearer, `ADMIN` | `{ decision: APPROVE\|REJECT, notes? }` | `RetailerProfile` |
| GET | `/admin/listings` | bearer, `ADMIN` | query: `status?, flagged?` | `Listing[]` |
| PATCH | `/admin/listings/:id/status` | bearer, `ADMIN` | `{ status, reason? }` | `Listing` |
| GET | `/admin/orders` | bearer, `ADMIN` | query: `status?, farmerId?, retailerId?` | `Order[]` |
| GET | `/admin/commission-rules` | bearer, `ADMIN` | — | `CommissionRule[]` |
| POST | `/admin/commission-rules` | bearer, `ADMIN` | `CreateCommissionRuleDto` | `CommissionRule` |
| PATCH | `/admin/commission-rules/:id` | bearer, `ADMIN` | `{ effectiveTo }` | `CommissionRule` (ends a rule; rules are immutable otherwise — create a new one to change a rate) |
| GET | `/admin/metrics/overview` | bearer, `ADMIN` | query: `from?, to?` | `{ gmv, commissionEarned, activeFarmers, activeRetailers, ordersByStatus }` |
| GET | `/admin/audit-logs` | bearer, `ADMIN` | query: `entityType?, entityId?` | `AuditLog[]` |
| GET | `/admin/reconciliation/mismatches` | bearer, `ADMIN` | query: `type?(payment\|payout), from?, to?` | `{ payments: Payment[], payouts: Payout[] }` — everything with `reconciliationStatus = MISMATCH`, i.e. our record disagrees with the gateway's settlement report |

## Conventions

- **Pagination**: `page` (1-based), `pageSize` (default 20, max 100) on all list endpoints; response wraps as
  `{ items, total, page, pageSize }`.
- **Idempotency**: `POST /orders/:id/payment-intent` and the payment webhook handler are idempotent — re-calling
  with an already-`CAPTURED` payment is a no-op that returns the current state, never a duplicate charge/payout.
- **Authorization**: role checked via a Nest guard reading the JWT; resource ownership (e.g. "this listing is
  yours") checked in the service layer against the authenticated user's `farmer_id`/`retailer_id`.
- **Versioning**: `/api/v1` prefix from day one so a breaking `v2` can be introduced later without disrupting
  existing clients.
