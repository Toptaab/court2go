/**
 * Central TanStack Query key factory (ARCHITECTURE §3.2: "query keys
 * namespaced `[tenantSlug, resource, ...params]`"). Every `lib/hooks/*` and
 * `lib/auth/hooks.ts` query hook builds its key here rather than inlining an
 * array literal at the call site — one place to keep keys consistent (and
 * to invalidate correctly after a mutation) as more resources are added
 * slice by slice.
 *
 * Member/admin session keys (`me`/`adminMe`) are NOT tenant-namespaced: the
 * session cookie itself is tenant-bound server-side (a session minted under
 * one tenant is invisible under another, ARCHITECTURE §3.3), so there's
 * never more than one live identity per browser session to key on.
 *
 * Public-catalog keys (added from M10.3 on) DO take `tenantSlug` as the
 * leading segment, once path-based tenant routing (`[tenantSlug]`,
 * ARCHITECTURE §2.2) lands — `publicTenant` below is the first of those.
 */
export const queryKeys = {
  me: () => ['auth', 'member', 'me'] as const,
  adminMe: () => ['auth', 'admin', 'me'] as const,
  publicTenant: (slug: string) => ['public', 'tenant', slug] as const,

  // --- Public catalog (M10.3) ---
  news: (slug: string, page?: number) => ['public', slug, 'news', { page }] as const,
  newsDetail: (slug: string, newsId: string) => ['public', slug, 'news', newsId] as const,
  branches: (slug: string) => ['public', slug, 'branches'] as const,
  sports: (slug: string, branchId: string) => ['public', slug, 'branches', branchId, 'sports'] as const,
  courts: (slug: string, branchId: string) => ['public', slug, 'branches', branchId, 'courts'] as const,
  courtDetail: (slug: string, courtId: string) => ['public', slug, 'courts', courtId] as const,
  availability: (slug: string, courtId: string, date: string) =>
    ['public', slug, 'courts', courtId, 'availability', date] as const,
};
