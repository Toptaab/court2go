# court2go — Build Plan (milestones)

Execution plan owned by the build loop. Data layer (Prisma schema/migrations/seed + repositories) and the contract (`packages/types`, `docs/openapi.yaml`) are DONE. Each milestone: build → typecheck → verify → commit.

Legend: ✅ done · 🟡 in progress · ⬜ not started

## M1 — NestJS bootstrap ✅
Bootable API skeleton: deps, `main.ts`, `AppModule`, `PrismaModule`, tenant-context middleware, global exception filter (error envelope), zod validation pipe, `/health`. Verifiable: `GET /health` 200, `GET /` boots, DB connects.

## M2 — Public catalog (read) ✅
`tenant` resolve by slug, `branches`, `branches/{id}/sports`, `.../courts`, `courts/{id}`, `news` (paginated). Reads through repositories → public DTO mappers (`PublicModule`). RLS exercised end-to-end against seed. Verified: full catalog chain 200, inactive/unknown court 404, no `promptPayId`/draft leak.

Infra fixed en route: `tsconfig-paths` + ts-node `moduleTypes` cjs override to consume ESM `@repo/types` source under a CommonJS Nest app.

## M3 — packages/domain (pricing + grid) ⬜
Grid/slot validation, mixed peak/base price breakdown, 30-min lattice expansion, hold TTL. Pure functions, unit-tested. Consumed by availability + bookings.

## M4 — Availability ⬜
`courts/{id}/availability` — per-court grid, active booking_slot reads, court schedule/blocks, peak ranges → free/taken grid.

## M5 — Member auth (OTP stub + LINE) ⬜
`auth/otp/request|verify` (OtpSender stub), LINE login-url/callback, session cookie, `me` profile, one-time phone bind. Phone-verified-once invariant.

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
