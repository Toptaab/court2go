import { meSchema, adminMeSchema, type Me, type AdminMe } from '@repo/types';
import { apiFetch, ApiClientError, type ApiFetchOptions } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';

/**
 * Session cookie names (ARCHITECTURE §3.3). Mirrors `MEMBER_SESSION_COOKIE`/
 * `ADMIN_SESSION_COOKIE` in `apps/api`'s `member-session.guard.ts`/
 * `admin-session.guard.ts` — duplicated as plain string constants (not
 * imported; `apps/web` never imports `apps/api` source) because the cookie
 * name itself is a stable, documented part of the contract, same as an
 * endpoint path.
 */
export const MEMBER_SESSION_COOKIE = 'c2g_member_session';
export const ADMIN_SESSION_COOKIE = 'c2g_admin_session';

/**
 * `GET /me` — the Member session's own view of its account. Returns `null`
 * on `UNAUTHENTICATED` (no/expired session) rather than throwing, since "not
 * logged in" is an expected, common outcome here — every caller (the
 * `useMe` hook and the server-side `requireMemberSession` guard) wants to
 * branch on that, not catch an exception. Any other failure (network, 5xx,
 * contract drift) still throws.
 *
 * `options` lets a Server Component forward the session cookie explicitly
 * (`Cookie: c2g_member_session=...` header) — SSR `fetch` has no browser
 * cookie jar, so `credentials: 'include'` alone (set inside `apiFetch`)
 * only carries the cookie automatically on browser-originated calls.
 *
 * `options.tenantSlug` defaults to `getDevDefaultTenantSlug()` (`lib/
 * tenant.ts`) — required today even for this session-authenticated call,
 * see that file for why; pass an explicit slug once a caller has a real one
 * (M10.3+ resolved-tenant context) to stop relying on the placeholder.
 */
export async function fetchMe(options: ApiFetchOptions = {}): Promise<Me | null> {
  try {
    return await apiFetch('/me', meSchema, {
      tenantSlug: getDevDefaultTenantSlug(),
      ...options,
    });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) return null;
    throw err;
  }
}

/** `GET /admin/me` — same null-on-401 contract and tenant-slug default as `fetchMe`, for AdminUser sessions. */
export async function fetchAdminMe(options: ApiFetchOptions = {}): Promise<AdminMe | null> {
  try {
    return await apiFetch('/admin/me', adminMeSchema, {
      tenantSlug: getDevDefaultTenantSlug(),
      ...options,
    });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) return null;
    throw err;
  }
}
