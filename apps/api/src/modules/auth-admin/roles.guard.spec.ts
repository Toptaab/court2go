import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function makeContext(role: string | undefined) {
  const req: any = role ? { adminAuth: { adminUser: { role } } } : {};
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function build(required: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as any;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows through when no @Roles metadata is present (no-op)', () => {
    const guard = build(undefined);
    expect(guard.canActivate(makeContext('BRANCH_ADMIN'))).toBe(true);
  });

  it('allows through when the admin role is in the allowed set', () => {
    const guard = build(['OWNER', 'ADMIN']);
    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });

  it('throws forbidden when the admin role is NOT in the allowed set', () => {
    const guard = build(['OWNER']);
    expect(() => guard.canActivate(makeContext('BRANCH_ADMIN'))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws forbidden when there is no adminAuth at all (guard misordered)', () => {
    const guard = build(['OWNER']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });
});
