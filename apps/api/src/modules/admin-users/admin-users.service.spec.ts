import type { AdminUser, Role } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { verifyPassword } from '../auth-admin/admin-password.util';
import type { AdminUsersRepository } from './admin-users.repository';
import type { AdminSessionsRepository } from '../auth-admin/admin-sessions.repository';
import type { AuditLogRepository } from '../audit/audit-log.repository';
import { AdminUsersService } from './admin-users.service';

/**
 * Unit coverage for the ADR-0005 role-immunity rules — the load-bearing admin
 * authorization logic (Owner immutable; Admin removable only by Owner) plus
 * immediate session revocation on deactivate/remove. Repos fully mocked.
 */
const TENANT_ID = 'tenant-1';
const uid = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;
const OWNER: AdminUser = makeAdmin(uid('01'), 'OWNER');
const ADMIN: AdminUser = makeAdmin(uid('02'), 'ADMIN');
const BRANCH_ADMIN: AdminUser = makeAdmin(uid('03'), 'BRANCH_ADMIN', uid('b1'));

function makeAdmin(id: string, role: Role, branchId: string | null = null): AdminUser {
  return {
    id,
    tenantId: TENANT_ID,
    email: `${id.slice(-2)}@x.co`,
    passwordHash: 'scrypt:aa:bb',
    name: `admin-${id.slice(-2)}`,
    role,
    branchId,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as AdminUser;
}

function build() {
  const adminUsers = {
    findById: jest.fn(),
    findByEmail: jest.fn().mockResolvedValue(null),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
  } as unknown as jest.Mocked<AdminUsersRepository>;
  const sessions = { revokeAllForAdminUser: jest.fn().mockResolvedValue({ count: 1 }) } as unknown as jest.Mocked<AdminSessionsRepository>;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditLogRepository>;
  const service = new AdminUsersService(adminUsers, sessions, audit);
  return { service, adminUsers, sessions, audit };
}

describe('AdminUsersService.create', () => {
  it('rejects a duplicate email', async () => {
    const { service, adminUsers } = build();
    (adminUsers.findByEmail as jest.Mock).mockResolvedValue(ADMIN);
    await expect(service.create(OWNER, { email: 'admin@x.co', name: 'n', password: 'password1', role: 'ADMIN' } as any)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('hashes the password (never stores plaintext) and creates the user', async () => {
    const { service, adminUsers } = build();
    (adminUsers.create as jest.Mock).mockImplementation(async (data) => makeAdmin(uid('99'), data.role, data.branchId));
    await service.create(OWNER, { email: 'new@x.co', name: 'New', password: 'password1', role: 'ADMIN', branchId: null } as any);
    const passed = (adminUsers.create as jest.Mock).mock.calls[0][0];
    expect(passed.passwordHash).not.toContain('password1');
    expect(verifyPassword('password1', passed.passwordHash)).toBe(true);
  });
});

describe('AdminUsersService.update', () => {
  it('refuses to modify an OWNER target (OWNER_IMMUTABLE)', async () => {
    const { service, adminUsers } = build();
    (adminUsers.findById as jest.Mock).mockResolvedValue(OWNER);
    await expect(service.update(OWNER, OWNER.id, { name: 'x' })).rejects.toMatchObject({ code: 'OWNER_IMMUTABLE' });
  });

  it('requires branchId when promoting to BRANCH_ADMIN', async () => {
    const { service, adminUsers } = build();
    (adminUsers.findById as jest.Mock).mockResolvedValue(makeAdmin(uid('f1'), 'ADMIN'));
    await expect(service.update(OWNER, 'x', { role: 'BRANCH_ADMIN' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('revokes sessions when deactivating', async () => {
    const { service, adminUsers, sessions } = build();
    const target = makeAdmin(uid('f2'), 'ADMIN');
    (adminUsers.findById as jest.Mock).mockResolvedValue(target);
    (adminUsers.update as jest.Mock).mockResolvedValue(target);
    (adminUsers.setActive as jest.Mock).mockResolvedValue({ ...target, isActive: false });
    await service.update(OWNER, target.id, { isActive: false });
    expect(sessions.revokeAllForAdminUser).toHaveBeenCalledWith(target.id);
  });
});

describe('AdminUsersService.remove', () => {
  it('refuses to remove an OWNER under any actor', async () => {
    const { service, adminUsers } = build();
    (adminUsers.findById as jest.Mock).mockResolvedValue(OWNER);
    await expect(service.remove(OWNER, OWNER.id)).rejects.toMatchObject({ code: 'OWNER_IMMUTABLE' });
  });

  it('refuses an ADMIN target unless the actor is OWNER', async () => {
    const { service, adminUsers } = build();
    (adminUsers.findById as jest.Mock).mockResolvedValue(makeAdmin(uid('f3'), 'ADMIN'));
    await expect(service.remove(ADMIN, 'x')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets the OWNER remove an ADMIN and revokes their sessions', async () => {
    const { service, adminUsers, sessions } = build();
    const target = makeAdmin(uid('f4'), 'ADMIN');
    (adminUsers.findById as jest.Mock).mockResolvedValue(target);
    (adminUsers.setActive as jest.Mock).mockResolvedValue({ ...target, isActive: false });
    await service.remove(OWNER, target.id);
    expect(adminUsers.setActive).toHaveBeenCalledWith(target.id, false);
    expect(sessions.revokeAllForAdminUser).toHaveBeenCalledWith(target.id);
  });

  it('lets an ADMIN remove a BRANCH_ADMIN', async () => {
    const { service, adminUsers } = build();
    (adminUsers.findById as jest.Mock).mockResolvedValue(BRANCH_ADMIN);
    (adminUsers.setActive as jest.Mock).mockResolvedValue({ ...BRANCH_ADMIN, isActive: false });
    await expect(service.remove(ADMIN, BRANCH_ADMIN.id)).resolves.toBeUndefined();
  });

  it('404s an unknown target', async () => {
    const { service, adminUsers } = build();
    (adminUsers.findById as jest.Mock).mockResolvedValue(null);
    await expect(service.remove(OWNER, 'nope')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('AdminUsersService.rolesMatrix', () => {
  it('returns a schema-valid capability grid', () => {
    const { service } = build();
    const matrix = service.rolesMatrix();
    expect(matrix.roles).toEqual(['OWNER', 'ADMIN', 'BRANCH_ADMIN']);
    expect(matrix.capabilities.length).toBeGreaterThan(0);
    // Branch admin cannot manage org-level config.
    const cfg = matrix.capabilities.find((c) => c.key === 'manage_config');
    expect(cfg?.allowed.BRANCH_ADMIN).toBe(false);
  });
});
