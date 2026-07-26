/**
 * True only in an explicitly dev/test environment. Deliberately fail-CLOSED:
 * an unset/unknown `NODE_ENV` is treated as production, so a prod deploy that
 * forgets to set `NODE_ENV` never drops the `Secure` cookie flag (or leaks
 * dev-only response fields). The dev server (`start:dev`) sets
 * `NODE_ENV=development` and Jest sets `NODE_ENV=test`, so dev ergonomics are
 * preserved. Shared by `auth-member` and `auth-admin` so the fail-closed
 * intent lives in exactly one place.
 */
export function isDevLikeEnv(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'test';
}
