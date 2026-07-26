import {
  generateOtpCode,
  hashOtpCode,
  otpCodeMatches,
  signLineState,
  verifyLineState,
} from './otp.util';

/**
 * Unit coverage for the dependency-free OTP + LINE-state crypto helpers
 * (ARCHITECTURE §4.1, §4.2). These guarantees are security-load-bearing:
 * codes are never stored in plaintext (hash is deterministic + verified in
 * constant time), and a LINE OAuth `state` cannot be forged or replayed
 * across tenants. No NestJS/Prisma coupling, so this is a pure unit test.
 */
describe('otp.util', () => {
  describe('generateOtpCode', () => {
    it('always returns a zero-padded 6-digit numeric string', () => {
      for (let i = 0; i < 1000; i++) {
        const code = generateOtpCode();
        expect(code).toMatch(/^\d{6}$/);
        expect(code.length).toBe(6);
      }
    });

    it('is not obviously constant across calls', () => {
      const codes = new Set(Array.from({ length: 50 }, () => generateOtpCode()));
      // 50 cryptographically random 6-digit draws colliding down to <5 distinct
      // values is astronomically unlikely — guards against a stubbed RNG.
      expect(codes.size).toBeGreaterThan(5);
    });
  });

  describe('hashOtpCode', () => {
    it('is deterministic for the same code + secret (no stored salt needed)', () => {
      expect(hashOtpCode('123456')).toBe(hashOtpCode('123456'));
    });

    it('produces a 64-char hex SHA-256 digest', () => {
      expect(hashOtpCode('000000')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('never returns the plaintext code', () => {
      const hash = hashOtpCode('424242');
      expect(hash).not.toContain('424242');
    });

    it('differs for different codes', () => {
      expect(hashOtpCode('111111')).not.toBe(hashOtpCode('222222'));
    });
  });

  describe('otpCodeMatches', () => {
    it('matches a code against its own stored hash', () => {
      expect(otpCodeMatches('654321', hashOtpCode('654321'))).toBe(true);
    });

    it('rejects a wrong code', () => {
      expect(otpCodeMatches('000001', hashOtpCode('000000'))).toBe(false);
    });

    it('returns false (never throws) on a malformed / wrong-length stored hash', () => {
      expect(otpCodeMatches('123456', 'not-a-hash')).toBe(false);
      expect(otpCodeMatches('123456', '')).toBe(false);
    });
  });

  describe('signLineState / verifyLineState', () => {
    const tenantId = 'tenant-abc';

    it('round-trips a state token for the issuing tenant', () => {
      const state = signLineState(tenantId);
      expect(verifyLineState(state, tenantId)).toBe(true);
    });

    it('embeds the tenant id and an HMAC signature (3 dot-separated parts)', () => {
      const state = signLineState(tenantId);
      const parts = state.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(tenantId);
    });

    it('issues a fresh nonce each call (no static replay token)', () => {
      expect(signLineState(tenantId)).not.toBe(signLineState(tenantId));
    });

    it('rejects the same token presented for a DIFFERENT tenant (cross-tenant replay)', () => {
      const state = signLineState(tenantId);
      expect(verifyLineState(state, 'tenant-other')).toBe(false);
    });

    it('rejects a token whose signature was tampered with', () => {
      const state = signLineState(tenantId);
      const [tid, nonce] = state.split('.');
      const forged = `${tid}.${nonce}.${'0'.repeat(64)}`;
      expect(verifyLineState(forged, tenantId)).toBe(false);
    });

    it('rejects a token whose tenant field was swapped (signature no longer covers it)', () => {
      const state = signLineState(tenantId);
      const [, nonce, sig] = state.split('.');
      const forged = `tenant-evil.${nonce}.${sig}`;
      expect(verifyLineState(forged, 'tenant-evil')).toBe(false);
    });

    it('rejects a structurally invalid token (wrong part count)', () => {
      expect(verifyLineState('garbage', tenantId)).toBe(false);
      expect(verifyLineState('a.b', tenantId)).toBe(false);
      expect(verifyLineState('a.b.c.d', tenantId)).toBe(false);
    });
  });
});
