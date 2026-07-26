import type { ExecutionContext } from '@nestjs/common';
import type { AdminSession, AdminUser } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { ADMIN_SESSION_COOKIE, AdminSessionGuard } from './admin-session.guard';
import type { AdminSessionsRepository } from './admin-sessions.repository';
import type { AdminUsersRepository } from '../admin-users/admin-users.repository';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
// Fixed timestamps so two factory calls are deep-equal (the guard test
// compares an attached row against a freshly-built expectation).
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

const adminSession = (over: Partial<AdminSession> = {}): AdminSession =>
  ({
    id: 'sess-1',
    tenantId: 'tenant-1',
    adminUserId: ADMIN_ID,
    expiresAt: new Date(FIXED_DATE.getTime() + 86_400_000),
    revokedAt: null,
    lastSeenAt: FIXED_DATE,
    createdAt: FIXED_DATE,
    ...over,
  }) as AdminSession;

const adminUser = (over: Partial<AdminUser> = {}): AdminUser =>
  ({
    id: ADMIN_ID,
    tenantId: 'tenant-1',
    email: 'owner@baseline-club.test',
    passwordHash: 'scrypt:aa:bb',
    name: 'Owner',
    role: 'OWNER',
    branchId: null,
    isActive: true,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...over,
  }) as AdminUser;

function makeContext(cookies: Record<string, string>) {
  const req: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function build() {
  const adminSessions = {
    findValid: jest.fn(),
    touchLastSeen: jest.fn(),
  } as unknown as jest.Mocked<AdminSessionsRepository>;
  const adminUsers = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<AdminUsersRepository>;
  const guard = new AdminSessionGuard(adminSessions, adminUsers);
  return { guard, adminSessions, adminUsers };
}

describe('AdminSessionGuard', () => {
  it('throws unauthenticated when no cookie is present', async () => {
    const { guard } = build();
    await expect(guard.canActivate(makeContext({}))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('throws unauthenticated when the cookie does not resolve to a valid session', async () => {
    const { guard, adminSessions } = build();
    adminSessions.findValid.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ [ADMIN_SESSION_COOKIE]: 'bogus' })),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('throws unauthenticated when the AdminUser no longer exists', async () => {
    const { guard, adminSessions, adminUsers } = build();
    adminSessions.findValid.mockResolvedValue(adminSession());
    adminUsers.findById.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ [ADMIN_SESSION_COOKIE]: 'sess-1' })),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('throws unauthenticated for a deactivated AdminUser (fail-closed defense-in-depth)', async () => {
    const { guard, adminSessions, adminUsers } = build();
    adminSessions.findValid.mockResolvedValue(adminSession());
    adminUsers.findById.mockResolvedValue(adminUser({ isActive: false }));
    await expect(
      guard.canActivate(makeContext({ [ADMIN_SESSION_COOKIE]: 'sess-1' })),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('allows through and attaches adminAuth + touches lastSeen for a valid, active admin', async () => {
    const { guard, adminSessions, adminUsers } = build();
    adminSessions.findValid.mockResolvedValue(adminSession());
    adminUsers.findById.mockResolvedValue(adminUser());
    const ctx = makeContext({ [ADMIN_SESSION_COOKIE]: 'sess-1' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const req = (ctx.switchToHttp().getRequest as any)();
    expect(req.adminAuth).toEqual({ sessionId: 'sess-1', adminUser: adminUser() });
    expect(adminSessions.touchLastSeen).toHaveBeenCalledWith('sess-1');
  });

  it('propagates ApiError instances (not generic errors)', async () => {
    const { guard } = build();
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(ApiError);
  });
});
