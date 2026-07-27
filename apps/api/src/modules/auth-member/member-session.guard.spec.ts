import type { ExecutionContext } from '@nestjs/common';
import type { ClientSession } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { tenantContextStorage } from '../../prisma/tenant-context';
import { MEMBER_SESSION_COOKIE, MemberSessionGuard } from './member-session.guard';
import type { ClientSessionsRepository } from './client-sessions.repository';

const MEMBER_ID = '00000000-0000-4000-8000-000000000002';
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

const clientSession = (over: Partial<ClientSession> = {}): ClientSession =>
  ({
    id: 'sess-1',
    tenantId: 'tenant-1',
    memberId: MEMBER_ID,
    expiresAt: new Date(FIXED_DATE.getTime() + 86_400_000),
    revokedAt: null,
    lastSeenAt: FIXED_DATE,
    createdAt: FIXED_DATE,
    ...over,
  }) as ClientSession;

function makeContext(cookies: Record<string, string>) {
  const req: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function build() {
  const clientSessions = {
    findValid: jest.fn(),
    touchLastSeen: jest.fn(),
  } as unknown as jest.Mocked<ClientSessionsRepository>;
  const guard = new MemberSessionGuard(clientSessions);
  return { guard, clientSessions };
}

/** Runs `fn` inside the same ALS context `TenantContextMiddleware` would
 * have pinned before this guard ever runs in a real request. */
function withTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContextStorage.run({ tenantId: 'tenant-1' }, fn);
}

describe('MemberSessionGuard', () => {
  it('throws unauthenticated when no cookie is present', async () => {
    const { guard } = build();
    await expect(guard.canActivate(makeContext({}))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('throws unauthenticated (not a 500) when a cookie is present but no tenant context was pinned — e.g. an expired/revoked/garbage session cookie with no x-tenant-id header (ARCHITECTURE §2.2 fail-closed)', async () => {
    const { guard, clientSessions } = build();
    await expect(
      guard.canActivate(makeContext({ [MEMBER_SESSION_COOKIE]: 'sess-1' })),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(clientSessions.findValid).not.toHaveBeenCalled();
  });

  it('throws unauthenticated when the cookie does not resolve to a valid session', async () => {
    const { guard, clientSessions } = build();
    clientSessions.findValid.mockResolvedValue(null);
    await expect(
      withTenantContext(() => guard.canActivate(makeContext({ [MEMBER_SESSION_COOKIE]: 'bogus' }))),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('allows through, attaches memberAuth, and touches lastSeen for a valid session', async () => {
    const { guard, clientSessions } = build();
    clientSessions.findValid.mockResolvedValue(clientSession());
    const ctx = makeContext({ [MEMBER_SESSION_COOKIE]: 'sess-1' });

    await expect(withTenantContext(() => guard.canActivate(ctx))).resolves.toBe(true);

    const req = (ctx.switchToHttp().getRequest as any)();
    expect(req.memberAuth).toEqual({ sessionId: 'sess-1', memberId: MEMBER_ID });
    expect(clientSessions.touchLastSeen).toHaveBeenCalledWith('sess-1');
  });

  it('propagates ApiError instances (not generic errors)', async () => {
    const { guard } = build();
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(ApiError);
  });
});
