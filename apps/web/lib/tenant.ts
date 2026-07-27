/**
 * PLACEHOLDER tenant-slug resolution (M10.2 only). Real resolution is
 * URL-based (ARCHITECTURE §2.2: `(public)/[tenantSlug]/...` for anonymous
 * browsing; the admin console's URL segment is present too, for
 * readability/bookmarking, even though it's never authoritative for
 * authorization) — that dynamic segment + a resolved-tenant context/
 * middleware is explicitly M10.3+ work (see `app/(public)/layout.tsx`'s
 * M10.1 note), not this slice's.
 *
 * Why M10.2 needs a slug at all, before that routing exists: `apps/api`'s
 * `TenantContextMiddleware` populates the request's tenant (`AsyncLocalStorage`)
 * ONLY from the `x-tenant-id` header — every tenant-scoped repository call
 * (including the session lookups behind `GET /me` / `GET /admin/me`) throws
 * without it, session cookie or not. ARCHITECTURE §2.2 documents a second
 * resolution path ("session's tenantId always overrides") that would make
 * this unnecessary for already-authenticated calls, but that path isn't
 * wired in the shipped middleware (its own doc comment: "Wired when auth
 * lands" — it isn't). Flagged for `nestjs-backend`; until it lands, every
 * `apps/web` call — public OR session-authenticated — must supply a slug.
 *
 * `NEXT_PUBLIC_DEV_TENANT_SLUG` lets a real multi-tenant deployment override
 * this without a code change; the hardcoded fallback is ARCHITECTURE's own
 * seeded dev tenant (`docs/ARCHITECTURE.md` §"Dev tenant: Baseline Club").
 * Delete this file once `[tenantSlug]` routing supplies a real per-request
 * slug to every call site instead.
 */
export function getDevDefaultTenantSlug(): string {
  return process.env.NEXT_PUBLIC_DEV_TENANT_SLUG ?? 'baseline-club';
}
