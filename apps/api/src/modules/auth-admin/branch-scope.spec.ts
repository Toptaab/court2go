import { assertBranchScope, BranchScopeGuard, type BranchScopedAdmin } from './branch-scope';
import { ApiError } from '../../common/api-error';

const BRANCH_A = '00000000-0000-4000-8000-00000000000a';
const BRANCH_B = '00000000-0000-4000-8000-00000000000b';

const admin = (over: Partial<BranchScopedAdmin> = {}): BranchScopedAdmin => ({
  role: 'BRANCH_ADMIN',
  branchId: BRANCH_A,
  ...over,
});

/**
 * `assertBranchScope` is the primary, unit-tested branch-scope guarantee
 * (ARCHITECTURE §3.3, ADR-0005) — services call this directly once they've
 * loaded a resource's `branchId`, independent of any HTTP-layer guard.
 */
describe('assertBranchScope', () => {
  it('BRANCH_ADMIN accessing their own branch passes', () => {
    expect(() => assertBranchScope(admin({ branchId: BRANCH_A }), BRANCH_A)).not.toThrow();
  });

  it('BRANCH_ADMIN accessing a different branch throws BRANCH_SCOPE_DENIED', () => {
    expect(() => assertBranchScope(admin({ branchId: BRANCH_A }), BRANCH_B)).toThrow(ApiError);
    expect(() => assertBranchScope(admin({ branchId: BRANCH_A }), BRANCH_B)).toThrow(
      expect.objectContaining({ code: 'BRANCH_SCOPE_DENIED' }),
    );
  });

  it('BRANCH_ADMIN against a null resourceBranchId throws BRANCH_SCOPE_DENIED', () => {
    expect(() => assertBranchScope(admin({ branchId: BRANCH_A }), null)).toThrow(
      expect.objectContaining({ code: 'BRANCH_SCOPE_DENIED' }),
    );
  });

  it('OWNER always passes regardless of resourceBranchId', () => {
    expect(() => assertBranchScope(admin({ role: 'OWNER', branchId: null }), BRANCH_A)).not.toThrow();
    expect(() => assertBranchScope(admin({ role: 'OWNER', branchId: null }), BRANCH_B)).not.toThrow();
    expect(() => assertBranchScope(admin({ role: 'OWNER', branchId: null }), null)).not.toThrow();
  });

  it('ADMIN always passes regardless of resourceBranchId', () => {
    expect(() => assertBranchScope(admin({ role: 'ADMIN', branchId: null }), BRANCH_A)).not.toThrow();
    expect(() => assertBranchScope(admin({ role: 'ADMIN', branchId: null }), BRANCH_B)).not.toThrow();
    expect(() => assertBranchScope(admin({ role: 'ADMIN', branchId: null }), null)).not.toThrow();
  });
});

/** Light guard coverage — the HTTP-layer convenience wrapper. */
describe('BranchScopeGuard', () => {
  function makeContext(adminAuth: { adminUser: BranchScopedAdmin } | undefined, query: Record<string, unknown> = {}) {
    const req: any = { adminAuth, query, params: {} };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  function makeGuard(metadata: unknown) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(metadata) } as any;
    return new BranchScopeGuard(reflector);
  }

  it('allows through when no @BranchScoped metadata is present', () => {
    const guard = makeGuard(undefined);
    const ctx = makeContext({ adminUser: admin() });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('BRANCH_ADMIN with no branchId supplied gets force-narrowed to their own branch', () => {
    const guard = makeGuard({ source: 'query' });
    const req: any = { adminAuth: { adminUser: admin({ branchId: BRANCH_A }) }, query: {}, params: {} };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => ({}), getClass: () => ({}) } as any;
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.query.branchId).toBe(BRANCH_A);
  });

  it('BRANCH_ADMIN supplying a foreign branchId is denied', () => {
    const guard = makeGuard({ source: 'query' });
    const ctx = makeContext({ adminUser: admin({ branchId: BRANCH_A }) }, { branchId: BRANCH_B });
    expect(() => guard.canActivate(ctx)).toThrow(ApiError);
  });

  it('OWNER/ADMIN pass through even with a foreign branchId query param', () => {
    const guard = makeGuard({ source: 'query' });
    const ctx = makeContext({ adminUser: admin({ role: 'OWNER', branchId: null }) }, { branchId: BRANCH_B });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws unauthenticated if adminAuth is missing (guard misordered)', () => {
    const guard = makeGuard({ source: 'query' });
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ApiError);
  });
});
