# packages/shared-types

Enums and small shared shapes (pagination, error shape, `LatLng`) used by `apps/api`, `apps/web` and
`apps/admin`, kept in lockstep with [`docs/erd.md`](../../docs/erd.md) and
[`docs/order-state-machine.md`](../../docs/order-state-machine.md).

Endpoint-specific request/response DTOs are intentionally not here yet — they arrive with the phase that
builds each endpoint (see `docs/architecture.md` §9), not the Foundation-phase scaffold.

```
pnpm --filter @farmer-to-retailer/shared-types build
```
