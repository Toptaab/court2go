import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Me, AdminMe } from '@repo/types';
import { fetchMe, fetchAdminMe, MEMBER_SESSION_COOKIE, ADMIN_SESSION_COOKIE } from './session';

/**
 * Server Component redirect guards (M10.2 exit; see `app/(member)/account/
 * page.tsx` and `app/(admin)/admin/page.tsx`, which call these). Each
 * forwards the session cookie explicitly as a `Cookie` header — `fetch`
 * during SSR has no browser cookie jar, so this is the one place `apps/web`
 * has to do that manually (client-side `useMe`/`useAdminMe`, `lib/auth/
 * hooks.ts`, rely on the browser's own cookie jar via `credentials:
 * 'include'` instead).
 *
 * Deliberately a PER-PAGE call, not wired into `(member)/layout.tsx` /
 * `(admin)/layout.tsx` themselves: M10.4 adds Member login screens INSIDE
 * `app/(member)/` (PLAN.md M10.4) and M10.7 adds the admin login screen
 * inside `app/(admin)/` — a layout-level guard would lock a visitor out of
 * the login page for the very group that page lives in. Each protected page
 * (not its group's login page) calls the matching `require*Session` at the
 * top of its Server Component body instead.
 */

async function memberSessionCookieHeader(): Promise<Record<string, string>> {
  const jar = await cookies();
  const value = jar.get(MEMBER_SESSION_COOKIE)?.value;
  return value ? { Cookie: `${MEMBER_SESSION_COOKIE}=${value}` } : {};
}

async function adminSessionCookieHeader(): Promise<Record<string, string>> {
  const jar = await cookies();
  const value = jar.get(ADMIN_SESSION_COOKIE)?.value;
  return value ? { Cookie: `${ADMIN_SESSION_COOKIE}=${value}` } : {};
}

/**
 * Redirects to `redirectTo` (default `/`, the public home) unless the
 * request carries a valid Member session; otherwise returns the resolved
 * `Me`. `redirectTo` is overridable because M10.4 will want this to point
 * at the real login route it creates.
 */
export async function requireMemberSession(redirectTo = '/'): Promise<Me> {
  const me = await fetchMe({ headers: await memberSessionCookieHeader() });
  if (!me) redirect(redirectTo);
  return me;
}

/**
 * Redirects to `redirectTo` (default `/admin/login` — the route M10.7
 * creates; a 404 until then is expected/acceptable for this plumbing-only
 * slice, same as the placeholder pages this guards) unless the request
 * carries a valid AdminUser session; otherwise returns the resolved
 * `AdminMe`.
 */
export async function requireAdminSession(redirectTo = '/admin/login'): Promise<AdminMe> {
  const admin = await fetchAdminMe({ headers: await adminSessionCookieHeader() });
  if (!admin) redirect(redirectTo);
  return admin;
}
