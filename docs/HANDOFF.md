# court2go — Build Handoff

Status snapshot and next-process kickoff for the court/venue booking SaaS (demo tenant **Baseline Club**).

## Where we are

| Artifact | State | Location |
|---|---|---|
| PRD | ✅ Final (rev 6) | [`docs/PRD.md`](./PRD.md) |
| UI design (all screens) | ✅ In Claude Design, rendered | [`docs/DESIGN.md`](./DESIGN.md) → project link |
| Architecture | ✅ Done | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) + [`docs/adr/`](./adr/) |
| API contract | ✅ Done | [`docs/openapi.yaml`](./openapi.yaml) · [`docs/API.md`](./API.md) · [`packages/types`](../packages/types) |
| Data schema | ✅ Done | [`docs/ERD.md`](./ERD.md) · [`apps/api/prisma`](../apps/api/prisma) · [`apps/api/src/prisma`](../apps/api/src/prisma) · [`apps/api/src/modules/**/*.repository.ts`](../apps/api/src/modules) |
| Code | 🟡 Data layer only (Prisma schema/migrations/seed + repositories) — NestJS app (modules/controllers/services), Next.js web, and `packages/domain` not started | — |

Target stack (per available agent pipeline): **Next.js (web) + NestJS (api) monorepo**, Turborepo, Prisma, shared zod/TS types, TanStack Query, Tailwind + shadcn.

## Next steps (ordered)

1. **`solution-architect`** — system design: monorepo layout (`apps/web`, `apps/api`, `packages/types`), multi-tenant strategy, tech boundaries, ADRs. Reads PRD + DESIGN.
2. **`api-designer`** — OpenAPI + shared zod/TS types both apps bind to. Cover: auth (phone+OTP, LINE login, one-time phone bind), branches/sports/courts, availability (per-court grid interval), bookings + hold lifecycle (start + slot count), payments (dynamic PromptPay QR + slip + confirm/reject), promotions, members, news, config, branding, roles.
3. **`prisma-data`** — schema + migrations + ERD. Core entities from PRD §4: Tenant, Branch, Sport, Court (day schedule + grid interval + max slots + base/peak pricing per grid unit), Slot/grid, Booking (+ status machine), Member (+ phone-verified flag), Payment (+ status machine), Promotion, News, AdminUser (Owner/Admin/Branch Admin), Config.
4. **`lead`** — milestone plan (`docs/PLAN.md`) → build→test→review→fix loop. Frontend built against the Claude Design pages.

## Resolved decisions

1. **Integrations (RESOLVED):**
   - **LINE Login + LINE OA notifications → REAL.** ✅ Credentials collected — LINE Login channel ID/secret + Messaging API channel access token/secret stored in gitignored `.env` (template in `.env.example`). Callback + webhook URLs use an ngrok tunnel (set per dev session).
   - **SMS OTP → STUBBED** behind an `OtpSender` interface (log/return the code in dev; swap a real gateway later). No SMS provider account needed now.
   - **PromptPay QR → REAL** (deterministic EMVCo payload from Branch PromptPay ID + amount; no gateway).
2. **Multi-tenancy (RESOLVED): tenant-scoped from day 1.** Tenant isolation baked into schema + every query; seed Baseline Club as the dev tenant. Same phone = independent Member per tenant.

## Open decisions (RESOLVED by architect — see ARCHITECTURE.md + ADRs)

3. **Payment/booking state machines → RESOLVED.** Status sets from PRD §4 confirmed + frozen, with state diagrams in ARCHITECTURE.md §6. One gap fixed (ADR-0006): `EXPIRED` must be reachable from `PENDING_VERIFICATION` for **both** Pay-Onsite and QR branches (not QR-only), else an abandoned Pay-Onsite verification orphans a Hold.

4. **Hold/concurrency → RESOLVED (ADR-0003).** `booking_slot` table, one row per consumed grid unit, with Postgres **partial unique index** `UNIQUE (court_id, slot_start) WHERE released_at IS NULL`. Conflicting insert → `23505` → whole transaction rolls back atomically. Same path for client + admin walk-in. Lazy + cron expiry sweep. Grid unit size = the Court's grid interval.

## Hard invariants (from PRD — must survive to code)

- No booking reaches **Confirmed** without both (a) a phone-verified/logged-in Member (or auditable staff override) and (b) a confirmed Payment (or Pay-Onsite terminal).
- Phone verified via SMS OTP **once per Member**, never per booking. OTP is **SMS only** — never LINE.
- Start times align to each Court's **grid interval** (per-court config, chosen from {30,60,90,120} min); a booking spans **1..`maxSlots`** contiguous grid units (max slots is per-court config). Total duration = slot count × grid interval.
- **Mixed peak/base pricing = sum of per-grid-unit prices** (each occupied grid unit charged base or peak by the range its start falls into).
- Per-**Branch** payment method: *Pay Onsite* (auto-confirm after phone verify) vs *QR Code* (dynamic PromptPay + slip + admin confirm).
- **Strict tenant data isolation** — same phone = independent Member per tenant.
- Roles: Owner (unremovable) / Admin (Owner-removable) / Branch Admin (single-branch scope, enforced server-side).
- Self-service cancellation requests up to 2h before start, admin-approved.
