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

  // --- Member bookings (M10.5) ---
  bookingDetail: (bookingId: string) => ['member', 'bookings', bookingId] as const,
  myBookings: (scope?: string, page?: number) => ['member', 'bookings', 'list', { scope, page }] as const,

  // --- Admin (M10.7) ---
  adminBookings: (params: Record<string, unknown>) => ['admin', 'bookings', 'list', params] as const,
  /** Prefix shared by every `adminBookings(params)` key — invalidate this (M10.8 booking-action
   * hooks) to refresh the list/queue pages regardless of their current filter params. */
  adminBookingsListPrefix: () => ['admin', 'bookings', 'list'] as const,
  adminCalendar: (branchId: string, date: string) => ['admin', 'bookings', 'calendar', branchId, date] as const,
  /** Prefix shared by every `adminCalendar(branchId, date)` key. */
  adminCalendarPrefix: () => ['admin', 'bookings', 'calendar'] as const,
  adminBookingDetail: (bookingId: string) => ['admin', 'bookings', bookingId] as const,

  // --- Admin catalog (M10.9) ---
  adminBranches: () => ['admin', 'catalog', 'branches', 'list'] as const,
  adminBranchDetail: (branchId: string) => ['admin', 'catalog', 'branches', branchId] as const,
  adminSports: () => ['admin', 'catalog', 'sports', 'list'] as const,
  adminCourts: (branchId?: string) => ['admin', 'catalog', 'courts', 'list', { branchId }] as const,
  /** Prefix shared by every `adminCourts(branchId)` key — invalidate regardless of the current branch filter. */
  adminCourtsListPrefix: () => ['admin', 'catalog', 'courts', 'list'] as const,
  adminCourtDetail: (courtId: string) => ['admin', 'catalog', 'courts', courtId] as const,
  adminCourtBlocks: (courtId: string) => ['admin', 'catalog', 'courts', courtId, 'blocks'] as const,
};
