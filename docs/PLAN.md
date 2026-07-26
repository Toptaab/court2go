# court2go — Build Plan (milestones)

Execution plan owned by the build loop. Data layer (Prisma schema/migrations/seed + repositories) and the contract (`packages/types`, `docs/openapi.yaml`) are DONE. Each milestone: build → typecheck → verify → commit.

Legend: ✅ done · 🟡 in progress · ⬜ not started

## M1 — NestJS bootstrap ✅
Bootable API skeleton: deps, `main.ts`, `AppModule`, `PrismaModule`, tenant-context middleware, global exception filter (error envelope), zod validation pipe, `/health`. Verifiable: `GET /health` 200, `GET /` boots, DB connects.

## M2 — Public catalog (read) ✅
`tenant` resolve by slug, `branches`, `branches/{id}/sports`, `.../courts`, `courts/{id}`, `news` (paginated). Reads through repositories → public DTO mappers (`PublicModule`). RLS exercised end-to-end against seed. Verified: full catalog chain 200, inactive/unknown court 404, no `promptPayId`/draft leak.

Infra fixed en route: `tsconfig-paths` + ts-node `moduleTypes` cjs override to consume ESM `@repo/types` source under a CommonJS Nest app.

## M3 — packages/domain (pricing + grid) ✅
Grid/slot validation, mixed peak/base price breakdown, 30-min lattice expansion, hold TTL. Pure functions, unit-tested. Consumed by availability + bookings.

Shipped as `@repo/domain`: `grid.ts` (`isGridAligned`, `gridStartMinutes`, `maxSlotsFromStart`, `latticeUnitsForBooking`, `expandToLattice`, `validateBookingSelection`), `pricing.ts` (`isPeakAtStart`, `priceForGridUnit`, `computePriceBreakdown` — output satisfies `priceBreakdownSchema`, drop-in for `CreateHoldInput`), `hold.ts` (`computeHoldExpiry`, `isHoldExpired`, `remainingHoldMs`). All types reused from `@repo/types` (no redefinition). Jest wired for the workspace (root `test`/`typecheck` fan-out); the previously-queued `apps/api` `prisma-errors` P2002 classifier spec now runs green (7 tests) — no longer queued. 51 domain unit tests pass incl. the PRD A5.1 AC10 worked example; reviewer clean.

**Carried flag for M6 (schema owner, `packages/types`):** `timeOfDaySchema` permits a court `openTime` off the :00/:30 lattice (e.g. 08:15), which would push the fixed 30-min lock lattice off-grid (ARCHITECTURE §5.1/§5.4 silent-double-book risk). `validateBookingSelection` now rejects off-lattice starts (`OFF_LATTICE`) as defense-in-depth, but `openTime` should additionally be constrained to 30-min alignment at the schema/data layer before M6 consumes holds.

## M4 — Availability ⬜
`courts/{id}/availability` — per-court grid, active booking_slot reads, court schedule/blocks, peak ranges → free/taken grid.

## M5 — Member auth (OTP stub + LINE) ✅
`auth/otp/request|verify` (OtpSender stub), LINE login-url/callback, session cookie, `me` profile, one-time phone bind. Phone-verified-once invariant.

Shipped in `apps/api`: a hexagonal `IntegrationsModule` (`@Global`) binding `OTP_SENDER`/`LINE_CLIENT` ports to env-selected adapters — `StubSmsAdapter` (logs the code) and `StubLineAdapter` (deterministic `lineUserId` from the auth code) — so real SMS/LINE providers drop in as one factory `case` with no consumer change. `AuthMemberService` orchestrates: HMAC-SHA256-hashed OTP (never plaintext, constant-time compare, crypto-random 6-digit), per-challenge attempt cap + Tenant-configurable resend cooldown & rolling-hour send cap, HMAC-signed tenant-bound LINE `state` (forgery/cross-tenant rejected), and a DB-backed `ClientSession` → `httpOnly` `c2g_member_session` cookie. LOGIN auto-provisions/verifies a Member; BIND enforces challenge-owner match + PHONE-VERIFIED-ONCE (`DUPLICATE_MEMBER` conflict). `MeController` GET/PATCH (phone immutable — changes go via OTP BIND). Tenant isolation rides `withTenant()`/RLS on every read/write. 57 api unit tests pass (+2 from review); tsc clean.

Reviewer findings addressed: (1) added `@HttpCode(200)` to the four `@Post` auth handlers (NestJS defaulted to 201, drifting from openapi's 200); (2) OTP `devCode` disclosure and the cookie `Secure` flag now gate on an explicit dev/test allow-list (`isDevLikeEnv`) — **fail-closed** so an unset `NODE_ENV` in prod never leaks codes or drops `Secure` (dev ergonomics preserved via `NODE_ENV=development` in `start:dev`); (3) blocked Members (`isBlocked`) are now rejected at every session-mint path (OTP + LINE) with `MEMBER_BLOCKED`/403, defense-in-depth for the admin-block invariant. Deferred (🟢, both stub-only): LINE `state` carries no issued-at/expiry (no replay window — revisit with the real LINE adapter); cookie `sameSite:'lax'` assumes web+api share a registrable domain — if prod splits them cross-site, switch to `SameSite=None; Secure` (M11 deploy/topology decision).

## M6 — Booking + hold lifecycle ⬜
`courts/{id}/holds` (create hold via safety-critical path), promotion apply, cancellation-request, `me/bookings`, status machine wiring. Hold-expiry cron job.

## M7 — Payments ⬜
Pay-Onsite auto-confirm; QR: dynamic PromptPay EMVCo payload, slip upload-url + slip submit, admin confirm/reject. Payment status machine.

## M8 — Admin auth + RBAC ⬜
`admin/auth/login|logout`, `admin/me`, role guards (Owner/Admin/Branch Admin), branch-scope enforcement.

## M9 — Admin bookings + catalog + promotions + news + config/branding ⬜
Full admin surface per openapi `/admin/**`.

## M10 — apps/web (Next.js) ⬜
App Router, TanStack Query, Tailwind + shadcn, bound to Claude Design pages + `@repo/types`. Client booking flow + admin console.

## M11 — Hardening ⬜
Rate limiting, audit log wiring, e2e (Playwright), CI (turbo pipeline), Docker/deploy.
