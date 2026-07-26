import { randomBytes, scryptSync } from 'node:crypto';
import { hashPassword, verifyPassword } from './admin-password.util';

/**
 * Unit coverage for the dependency-free scrypt password hashing helpers
 * (ADR-0005). Security-load-bearing: verification must be constant-time and
 * must never throw on malformed input (a corrupt/foreign stored value must
 * resolve to `false`, not a 500).
 */
describe('admin-password.util', () => {
  describe('hashPassword / verifyPassword round-trip', () => {
    it('verifies a password against its own hash', () => {
      const stored = hashPassword('correct-horse-battery-staple');
      expect(verifyPassword('correct-horse-battery-staple', stored)).toBe(true);
    });

    it('produces the documented self-describing format', () => {
      const stored = hashPassword('anything');
      expect(stored).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    });

    it('produces a different salt (and thus hash) each call', () => {
      const a = hashPassword('same-password');
      const b = hashPassword('same-password');
      expect(a).not.toBe(b);
    });
  });

  describe('verifyPassword rejects wrong input', () => {
    it('rejects a wrong password', () => {
      const stored = hashPassword('the-real-password');
      expect(verifyPassword('not-the-real-password', stored)).toBe(false);
    });

    it('rejects an empty password against a real hash', () => {
      const stored = hashPassword('the-real-password');
      expect(verifyPassword('', stored)).toBe(false);
    });
  });

  describe('malformed / mismatched stored values never throw', () => {
    it('handles a completely malformed stored value', () => {
      expect(() => verifyPassword('pw', 'not-a-hash')).not.toThrow();
      expect(verifyPassword('pw', 'not-a-hash')).toBe(false);
    });

    it('handles an empty stored value', () => {
      expect(verifyPassword('pw', '')).toBe(false);
    });

    it('handles a wrong-prefix stored value', () => {
      expect(verifyPassword('pw', 'bcrypt:aa:bb')).toBe(false);
    });

    it('handles a stored value with a length-mismatched hash (no throw)', () => {
      const salt = randomBytes(16).toString('hex');
      const shortHash = randomBytes(8).toString('hex'); // wrong keylen vs. the 64-byte scheme
      const stored = `scrypt:${salt}:${shortHash}`;
      expect(() => verifyPassword('pw', stored)).not.toThrow();
      expect(verifyPassword('pw', stored)).toBe(false);
    });

    it('handles non-hex garbage in the salt/hash segments', () => {
      expect(() => verifyPassword('pw', 'scrypt:zzzz:zzzz')).not.toThrow();
      expect(verifyPassword('pw', 'scrypt:zzzz:zzzz')).toBe(false);
    });
  });

  describe('interoperability with the seed script scheme', () => {
    it('verifies a hash produced by the exact seed algorithm (scryptSync(pw, salt, 64))', () => {
      const salt = randomBytes(16);
      const hash = scryptSync('dev-password-change-me', salt, 64);
      const stored = `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
      expect(verifyPassword('dev-password-change-me', stored)).toBe(true);
      expect(verifyPassword('wrong', stored)).toBe(false);
    });
  });
});
