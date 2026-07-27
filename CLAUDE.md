# court2go — project guide

Multi-tenant court-booking platform (Thailand MVP). Monorepo, pnpm workspaces.

## Layout
- `apps/api` — NestJS backend (only app built so far; `apps/web` Next.js is M10, not yet created).
- `packages/types` — the API contract: zod schemas + TS types. Source of truth, mirrors `docs/openapi.yaml`. **Both front and back bind this — never redefine a type locally.**
- `packages/domain` — pure business logic (`grid.ts`, `pricing.ts`, `hold.ts`, `promptpay.ts`), unit-tested, no I/O. Reuse these; do not reimplement pricing/grid/hold math.
- `docs/` — source-of-truth specs: `PRD.md` (requirements + acceptance criteria), `DESIGN.md`, `ARCHITECTURE.md` (+ `adr/`), `API.md` + `openapi.yaml`, `ERD.md`, `PLAN.md` (milestone build plan), `HANDOFF.md`.

## Commands (run from repo root)
- `npm test` — jest across workspaces (`--workspaces --if-present`).
- `npm run typecheck` — tsc across workspaces.
- Both must be green before a milestone is done.

## Non-negotiable invariants
- **Tenant isolation via Postgres RLS.** Every read/write goes through `withTenant()`; tenant resolved from header/context. Never bypass RLS or leak cross-tenant rows.
- **Contract discipline.** Change the contract only in `packages/types` (+ `openapi.yaml`), via the api-designer agent. If types change, re-run and re-test BOTH sides in the same cycle.
- **Double-book guard is the `uniq_active_court_slot` partial index** → `SlotUnavailableError` → 409. It is the ultimate safety net; do not rely on app-level checks alone.
- **Fixed 30-min lock lattice.** Court `openTime`/`closeTime` constrained to `:00`/`:30` (schema + DB CHECK). Booking selection re-validated server-side (`validateBookingSelection`, `OFF_LATTICE` guard).
- **Price is always re-derived server-side** (`computePriceBreakdown`); client-sent price is never trusted. Promo apply/remove re-prices off the booking's SNAPSHOT, never live court config.
- **Phone-verified-once** per member (`DUPLICATE_MEMBER` conflict on violation). Phone immutable except via OTP BIND.
- **Sole paths to `CONFIRMED`:** `advanceOutOfVerification` (out of PENDING_VERIFICATION) and `confirmPayment` (admin slip-confirm) — both authoritative status-guarded txns in `BookingsRepository`. No DB convergence trigger; never add a parallel CONFIRMED writer.
- **Timezone: ICT = UTC+7 fixed** (Thailand-only, no tz stored). Weekday resolved via UTC.
- **Audit row on every status change.**

## Admin (M8/M9) RBAC
- Every `/admin/**` route behind `AdminSessionGuard` + `RolesGuard`.
- Branch-scoped routes enforce `assertBranchScope(adminUser, resourceBranchId)` → 403 `BRANCH_SCOPE_DENIED`. Owner/Admin = tenant-wide; Branch-Admin = scoped.
- Admin-user CRUD role rules per ADR-0005: only Owner may deactivate an Admin; `remove` refuses OWNER always.

## Conventions
- Error responses use the global exception filter's error envelope; illegal state transition → 409 `INVALID_STATE_TRANSITION`.
- HTTP status codes must match `openapi.yaml` (auth POSTs are `@HttpCode(200)`, not Nest's default 201).
- Fail-closed on env-gated behavior (dev-only disclosures gate on an explicit dev/test allow-list, never on an unset `NODE_ENV`).
- Integrations are hexagonal: a port + env-selected adapter (SMS, LINE, ObjectStorage, PromptPayQr). Real providers (S3/R2, real SMS/LINE) drop in at M11 with no consumer change.

## Current state
M1–M7 done (bootstrap, public catalog, domain, availability, member auth, booking+hold, payments). M8 (admin auth+RBAC) + M9 (admin surface) in progress. M10 = Next.js web. M11 = hardening/CI/deploy. See `docs/PLAN.md` for the authoritative milestone status.
