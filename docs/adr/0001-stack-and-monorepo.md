# ADR-0001: Stack and monorepo structure

## Status
Accepted

## Context
Target stack is fixed by HANDOFF/PRD process: Next.js + NestJS, TypeScript throughout, Prisma, shared zod/TS types, TanStack Query, Tailwind + shadcn. What's left to decide is monorepo tooling, package boundaries, and where the client/admin surfaces live.

The build has two very different frontends sharing one backend: a mobile-first public client flow (news feed, booking, OTP/LINE login, slip upload, history) and a desktop-oriented admin console (calendar, queues, config, RBAC) — per DESIGN.md's M-series and D-series screens. Both need to be correct against the same booking/payment/pricing rules, and both need the same tenant-branding pipeline.

## Decision
- **Turborepo** for task orchestration + caching, **pnpm workspaces** for package management.
- `apps/web` is a **single** Next.js 15 App Router app serving both surfaces via route groups: `(public)/[tenantSlug]/...` and `(admin)/[tenantSlug]/admin/...`. Not two separate Next apps.
- `apps/api` is a single NestJS app, modularized by domain (bookings, payments, members, admin-users, ...).
- `packages/types`: zod schemas + inferred TS types — the wire contract, imported by both apps, never containing logic.
- `packages/domain`: pure, side-effect-free business functions (pricing calculator, grid/duration validators, EMVCo PromptPay payload builder) imported by both apps — `apps/api` uses it authoritatively, `apps/web` uses it for optimistic preview only.
- `packages/config`: shared eslint/tsconfig/tailwind/prettier config.
- Prisma's generated types stay internal to `apps/api`; API controllers map Prisma entities to `packages/types` DTOs before returning a response — the DB schema and the wire contract are allowed to diverge (e.g. `booking_slot`, `otp_challenge`, session tables never appear in the public API).

## Consequences
- One Vercel deployment for web, one container deployment for the API — simple, matches the two-actor/two-surface reality without doubling build/deploy surfaces for the admin console (which needs auth regardless of which app serves it).
- `packages/domain` prevents pricing/grid-rule drift between what the client optimistically shows and what the API authoritatively enforces — but requires discipline that `apps/web` never trusts its own calculation for anything that affects money or booking state; the API recomputes everything from raw inputs at write time.
- Decoupling Prisma models from `packages/types` DTOs means every new field requires an explicit mapping step in the controller layer (slightly more boilerplate) in exchange for never accidentally exposing internal-only columns (audit metadata, hashed OTP codes, session tokens) over the wire.
- A single Next app means both surfaces build/deploy together; a regression in the admin console could in principle affect a public-site deploy. Acceptable for MVP scale; splitting later (if the admin console outgrows this) is a low-risk extraction since it's already isolated by route group and auth boundary.
