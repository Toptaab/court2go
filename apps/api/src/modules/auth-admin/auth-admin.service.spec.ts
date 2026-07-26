import type { Response } from 'express';
import type { AdminUser, AdminSession } from '../../generated/prisma/client';
import type { AdminUsersRepository } from '../admin-users/admin-users.repository';
import type { AdminSessionsRepository } from './admin-sessions.repository';
import { ADMIN_SESSION_COOKIE } from './admin-session.guard';
import { AuthAdminService } from './auth-admin.service';
import { hashPassword } from './admin-password.util';

const TENANT = 'tenant-1';
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const BRANCH_ID = '00000000-0000-4000-8000-000000000002';
const PASSWORD = 'correct-horse-battery-staple';

const adminUser = (over: Partial<AdminUser> = {}): AdminUser =>
  ({
    id: ADMIN_ID,
    tenantId: TENANT,
    email: 'owner@baseline-club.test',
    passwordHash: hashPassword(PASSWORD),
    name: 'Baseline Club Owner',
    role: 'OWNER',
    branchId: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as AdminUser;

const adminSession = (over: Partial<AdminSession> = {}): AdminSession =>
  ({
    id: 'sess-1',
    tenantId: TENANT,
    adminUserId: ADMIN_ID,
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
    revokedAt: null,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    ...over,
  }) as AdminSession;

function makeRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response & { cookie: jest.Mock; clearCookie: jest.Mock };
}

function build() {
  const adminUsers = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
  } as unknown as jest.Mocked<AdminUsersRepository>;

  const adminSessions = {
    create: jest.fn().mockResolvedValue(adminSession()),
    findValid: jest.fn(),
    touchLastSeen: jest.fn(),
    revoke: jest.fn(),
    revokeAllForAdminUser: jest.fn(),
  } as unknown as jest.Mocked<AdminSessionsRepository>;

  const service = new AuthAdminService(adminUsers, adminSessions);
  return { service, adminUsers, adminSessions };
}

/**
 * Orchestration coverage for admin auth (ADR-0005, ARCHITECTURE §3.3) —
 * mirrors `auth-member.service.spec.ts`'s mocking style. Repositories are
 * fully mocked; their own tenant/RLS behaviour is covered elsewhere.
 */
describe('AuthAdminService', () => {
  describe('login', () => {
    it('happy path: mints a session, sets the cookie, and returns a parsed AdminSessionResponse', async () => {
      const { service, adminUsers, adminSessions } = build();
      adminUsers.findByEmail.mockResolvedValue(adminUser());
      const res = makeRes();

      const out = await service.login({ email: 'owner@baseline-club.test', password: PASSWORD }, res);

      expect(adminSessions.create).toHaveBeenCalledWith(ADMIN_ID, expect.any(Date));
      expect(res.cookie).toHaveBeenCalledWith(
        ADMIN_SESSION_COOKIE,
        'sess-1',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
      );
      expect(out.admin.id).toBe(ADMIN_ID);
      expect(out.admin).not.toHaveProperty('passwordHash');
      expect(out.sessionExpiresAt).toEqual(expect.any(String));
    });

    it('rejects an unknown email with the generic ADMIN_CREDENTIALS_INVALID error', async () => {
      const { service, adminUsers, adminSessions } = build();
      adminUsers.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@baseline-club.test', password: PASSWORD }, makeRes()),
      ).rejects.toMatchObject({ code: 'ADMIN_CREDENTIALS_INVALID' });
      expect(adminSessions.create).not.toHaveBeenCalled();
    });

    it('rejects a wrong password with the SAME generic error (no user enumeration)', async () => {
      const { service, adminUsers, adminSessions } = build();
      adminUsers.findByEmail.mockResolvedValue(adminUser());

      await expect(
        service.login({ email: 'owner@baseline-club.test', password: 'wrong-password' }, makeRes()),
      ).rejects.toMatchObject({ code: 'ADMIN_CREDENTIALS_INVALID' });
      expect(adminSessions.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive admin with the same generic error', async () => {
      const { service, adminUsers, adminSessions } = build();
      adminUsers.findByEmail.mockResolvedValue(adminUser({ isActive: false }));

      await expect(
        service.login({ email: 'owner@baseline-club.test', password: PASSWORD }, makeRes()),
      ).rejects.toMatchObject({ code: 'ADMIN_CREDENTIALS_INVALID' });
      expect(adminSessions.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const { service, adminSessions } = build();
      const res = makeRes();
      await service.logout('sess-1', res);
      expect(adminSessions.revoke).toHaveBeenCalledWith('sess-1');
      expect(res.clearCookie).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE, { path: '/' });
    });
  });

  describe('me', () => {
    it('maps the AdminUser to the contract DTO without leaking passwordHash', () => {
      const { service } = build();
      const out = service.me(adminUser({ role: 'BRANCH_ADMIN', branchId: BRANCH_ID }));
      expect(out).toEqual({
        id: ADMIN_ID,
        email: 'owner@baseline-club.test',
        name: 'Baseline Club Owner',
        role: 'BRANCH_ADMIN',
        branchId: BRANCH_ID,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(out).not.toHaveProperty('passwordHash');
    });
  });
});
