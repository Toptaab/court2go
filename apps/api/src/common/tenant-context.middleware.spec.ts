import type { Request, Response } from 'express';
import { ApiError } from './api-error';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { tenantContextStorage } from '../prisma/tenant-context';
import type { Tenant } from '../generated/prisma/client';
import { ADMIN_SESSION_COOKIE } from '../modules/auth-admin/admin-session.guard';
import { MEMBER_SESSION_COOKIE } from '../modules/auth-member/member-session.guard';
import type { TenantsRepository } from '../modules/tenants/tenants.repository';

const TENANT_ID = '00000000-0000-4000-8000-0000000000aa';
const OTHER_TENANT_ID = '00000000-0000-4000-8000-0000000000bb';

const tenant = (over: Partial<Tenant> = {}): Tenant =>
  ({
    id: TENANT_ID,
    slug: 'baseline-club',
    name: 'Baseline Club',
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as Tenant;

function makeReq(opts: { cookies?: Record<string, string>; header?: string }): Request {
  return {
    cookies: opts.cookies ?? {},
    header: (_name: string) => opts.header,
  } as unknown as Request;
}

function build() {
  const tenants = {
    findBySlug: jest.fn(),
    resolveSessionTenant: jest.fn(),
  } as unknown as jest.Mocked<TenantsRepository>;
  const middleware = new TenantContextMiddleware(tenants);
  return { middleware, tenants };
}

/** Captures the tenant id (if any) that was pinned into ALS when `next()` ran. */
function captureNext(): { next: jest.Mock; getCapturedTenantId: () => string | undefined } {
  let captured: string | undefined;
  const next = jest.fn(() => {
    captured = tenantContextStorage.getStore()?.tenantId;
  });
  return { next, getCapturedTenantId: () => captured };
}

describe('TenantContextMiddleware', () => {
  it('admin cookie present + resolver returns tenant -> pins that tenant, ignoring a different header slug', async () => {
    const { middleware, tenants } = build();
    tenants.resolveSessionTenant.mockImplementation(async (kind) =>
      kind === 'admin' ? TENANT_ID : null,
    );
    const req = makeReq({ cookies: { [ADMIN_SESSION_COOKIE]: 'admin-sess-1' }, header: 'some-other-slug' });
    const { next, getCapturedTenantId } = captureNext();

    await middleware.use(req, {} as Response, next);

    expect(tenants.resolveSessionTenant).toHaveBeenCalledWith('admin', 'admin-sess-1');
    expect(tenants.findBySlug).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(getCapturedTenantId()).toBe(TENANT_ID);
  });

  it('member cookie present + resolver returns tenant -> pins that tenant', async () => {
    const { middleware, tenants } = build();
    tenants.resolveSessionTenant.mockImplementation(async (kind) =>
      kind === 'member' ? TENANT_ID : null,
    );
    const req = makeReq({ cookies: { [MEMBER_SESSION_COOKIE]: 'member-sess-1' } });
    const { next, getCapturedTenantId } = captureNext();

    await middleware.use(req, {} as Response, next);

    expect(tenants.resolveSessionTenant).toHaveBeenCalledWith('member', 'member-sess-1');
    expect(tenants.findBySlug).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(getCapturedTenantId()).toBe(TENANT_ID);
  });

  it('admin cookie resolves NULL, member cookie resolves a tenant -> falls through to member (admin precedence only applies when it actually resolves)', async () => {
    const { middleware, tenants } = build();
    tenants.resolveSessionTenant.mockImplementation(async (kind) =>
      kind === 'member' ? TENANT_ID : null,
    );
    const req = makeReq({
      cookies: { [ADMIN_SESSION_COOKIE]: 'bogus-admin', [MEMBER_SESSION_COOKIE]: 'member-sess-1' },
    });
    const { next, getCapturedTenantId } = captureNext();

    await middleware.use(req, {} as Response, next);

    expect(tenants.resolveSessionTenant).toHaveBeenNthCalledWith(1, 'admin', 'bogus-admin');
    expect(tenants.resolveSessionTenant).toHaveBeenNthCalledWith(2, 'member', 'member-sess-1');
    expect(getCapturedTenantId()).toBe(TENANT_ID);
  });

  it('no cookie, header present + valid slug -> header path still works (regression)', async () => {
    const { middleware, tenants } = build();
    tenants.findBySlug.mockResolvedValue(tenant());
    const req = makeReq({ header: 'baseline-club' });
    const { next, getCapturedTenantId } = captureNext();

    await middleware.use(req, {} as Response, next);

    expect(tenants.resolveSessionTenant).not.toHaveBeenCalled();
    expect(tenants.findBySlug).toHaveBeenCalledWith('baseline-club');
    expect(getCapturedTenantId()).toBe(TENANT_ID);
  });

  it('no cookie, header present with unknown slug -> 404 TENANT_NOT_FOUND (regression)', async () => {
    const { middleware, tenants } = build();
    tenants.findBySlug.mockResolvedValue(null);
    const req = makeReq({ header: 'nope' });
    const next = jest.fn();

    await middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.code).toBe('TENANT_NOT_FOUND');
  });

  it('no cookie, no header -> next() with no context (regression)', async () => {
    const { middleware } = build();
    const req = makeReq({});
    const { next, getCapturedTenantId } = captureNext();

    await middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(getCapturedTenantId()).toBeUndefined();
  });

  it('cookie present but resolver returns NULL (expired/revoked/garbage) -> falls through to header, does not 500', async () => {
    const { middleware, tenants } = build();
    tenants.resolveSessionTenant.mockResolvedValue(null);
    tenants.findBySlug.mockResolvedValue(tenant({ id: OTHER_TENANT_ID, slug: 'other-club' }));
    const req = makeReq({
      cookies: { [ADMIN_SESSION_COOKIE]: 'expired-admin-sess' },
      header: 'other-club',
    });
    const { next, getCapturedTenantId } = captureNext();

    await middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(getCapturedTenantId()).toBe(OTHER_TENANT_ID);
  });

  it('cookie present but resolver returns NULL, no header -> next() with no context, does not 500', async () => {
    const { middleware, tenants } = build();
    tenants.resolveSessionTenant.mockResolvedValue(null);
    const req = makeReq({ cookies: { [MEMBER_SESSION_COOKIE]: 'expired-member-sess' } });
    const { next, getCapturedTenantId } = captureNext();

    await middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(getCapturedTenantId()).toBeUndefined();
  });
});
