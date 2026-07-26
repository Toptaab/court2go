# @repo/types — the court2go API contract

The **single source of truth** for the wire between `apps/web` (Next.js) and
`apps/api` (NestJS). Zod schemas are authoritative; TS types are `z.infer`red from
them; `docs/openapi.yaml` is kept aligned with these schemas (ARCHITECTURE §3.1/§7).

**One schema per shape, reused both sides.** Never duplicate a shape:
- `apps/api` validates every request body/query with these schemas (NestJS pipe)
  and maps Prisma rows → these response DTOs before returning.
- `apps/web` validates forms with the same schemas via `zodResolver`, and parses
  every response through the matching schema (fail loud on drift, ARCHITECTURE §3.2).
- `prisma-data` declares Prisma enums 1:1 against `src/enums` and models entities
  against `src/entities` (the contract shape, not the reverse).

## Install / import

```ts
import {
  bookingStatusSchema, BookingStatus,
  createHoldBodySchema, CreateHoldResponse,
  priceBreakdownSchema,
} from '@repo/types';
```

Workspace dependency (both apps + prisma-data):

```jsonc
// apps/web/package.json, apps/api/package.json, packages/*/package.json
"dependencies": { "@repo/types": "workspace:*" }
```

## Layout

```
src/
  version.ts        CONTRACT_VERSION, API_BASE_PATH (/v1)
  common/           idSchema, thaiPhoneSchema, thbAmountSchema (satang),
                    isoDateTime/Date, timeOfDay, error envelope + codes, pagination
  enums/            frozen vocabularies — status machines, roles, methods, grid interval
  entities/         persisted resources + their `public*` client projections
  dto/              request/response shapes per endpoint surface
  index.ts          barrel (also `@repo/types/enums` subpath)
```

## Conventions baked into the schemas

- **Money** is integer **THB satang** (`thbAmountSchema`); 300.00 THB = `30000`.
  Human formatting lives in `packages/domain`/UI, never here.
- **Bookings take `slotCount`, not a duration.** Duration = `slotCount × gridInterval`;
  the fixed 30-min lock lattice (ARCHITECTURE §5) is internal and NOT in this contract.
- **Prices are server-authoritative.** `priceBreakdownSchema` is snapshotted onto the
  booking at hold time; clients may preview via `packages/domain` but a client-sent
  price is never accepted.
- **Public vs. admin projections** are separate schemas (`publicBranchSchema` etc.) so
  internal fields (`promptPayId`, `isActive`, audit ids) can't leak to the client bundle.
- **Errors**: every non-2xx is `errorEnvelopeSchema` `{ error: { code, message, details? } }`;
  switch on `error.code` (`API_ERROR_CODES`), never message text.

## Versioning

`CONTRACT_VERSION` (semver). A breaking schema change bumps MAJOR → both build agents
fail to compile until they react (compile-time safety, the intended behavior). The wire
echoes it as `X-Contract-Version`; `docs/openapi.yaml` `info.version` mirrors it.

## OpenAPI

`docs/openapi.yaml` (OpenAPI 3.1) is the human-reviewable spec, kept in lockstep with
these zod schemas. Zod remains the runtime source of truth; a `zod-to-openapi` generator
(`@asteasolutions/zod-to-openapi`, per ARCHITECTURE §3.2) is the intended fast-follow so
the component section is emitted directly from these schemas rather than maintained twice.
