import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * OTP + LINE-state crypto helpers (ARCHITECTURE §4.1, §4.2). Dependency-free
 * (node:crypto only) so this module has no NestJS/Prisma coupling and is
 * trivially unit-testable.
 */

/** 6-digit numeric OTP, cryptographically random (never `Math.random`). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function otpHashSecret(): string {
  return process.env.OTP_HASH_SECRET ?? 'dev-otp-secret';
}

/**
 * HMAC-SHA256(code), hex digest. Deterministic (same code + secret always
 * hashes the same) so `verify` can recompute-and-compare rather than needing
 * a stored salt — codes are NEVER stored in plaintext (ARCHITECTURE §4.1).
 */
export function hashOtpCode(code: string): string {
  return createHmac('sha256', otpHashSecret()).update(code).digest('hex');
}

/** Constant-time comparison of a candidate code against a stored hash. */
export function otpCodeMatches(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtpCode(code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function lineStateSecret(): string {
  return process.env.LINE_STATE_SECRET ?? process.env.OTP_HASH_SECRET ?? 'dev-line-state-secret';
}

/**
 * Issue an HMAC-signed LINE OAuth `state` token embedding the requesting
 * tenant + a random nonce (ARCHITECTURE §4.2), so `verifyLineState` on the
 * callback can confirm the state wasn't forged/replayed across tenants.
 * Format: `<tenantId>.<nonce>.<hmacHex>` (all hex/uuid-safe, no extra encoding
 * needed for use as a URL query param via `URLSearchParams`).
 */
export function signLineState(tenantId: string): string {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${tenantId}.${nonce}`;
  const signature = createHmac('sha256', lineStateSecret()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/** Verifies a `state` token was issued by `signLineState` for THIS tenant. */
export function verifyLineState(token: string, tenantId: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tid, nonce, signature] = parts;
  if (tid !== tenantId) return false;

  const expected = createHmac('sha256', lineStateSecret()).update(`${tid}.${nonce}`).digest('hex');
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
