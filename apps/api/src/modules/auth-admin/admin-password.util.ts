import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * AdminUser password hashing (ADR-0005). Self-describing format
 * `scrypt:<saltHex>:<hashHex>` — MUST match `apps/api/prisma/seed.ts`'s
 * placeholder hasher exactly (same `scryptSync(password, salt, 64)` call),
 * since the seed explicitly defers "the real verify implementation" to this
 * module. No new dependency (no bcrypt/argon2) — node:crypto's scrypt is
 * sufficient and keeps the seed and runtime in lockstep.
 */
const SCRYPT_KEYLEN = 64;
const SCRYPT_PREFIX = 'scrypt';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Constant-time verify. Never throws — a malformed/foreign `stored` value or
 * a length mismatch (which would otherwise throw inside `timingSafeEqual`)
 * simply resolves to `false`, so a corrupt row can never become a 500 that
 * leaks information via error behaviour.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== SCRYPT_PREFIX) return false;

  const [, saltHex, hashHex] = parts;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = scryptSync(plain, salt, expected.length);
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}
