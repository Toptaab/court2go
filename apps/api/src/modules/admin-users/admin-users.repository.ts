import { Injectable } from '@nestjs/common';
import { AdminUser, Role } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/**
 * AdminUser (PRD §4, A9). Role-removal-immunity rules (Owner unremovable;
 * Admin removable only by Owner) are enforced in `AdminUsersService`, NOT
 * here — this repository will happily deactivate anyone it's told to. That
 * split keeps the business rule in one reviewable place (ARCHITECTURE §3.3).
 */
@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<AdminUser | null> {
    return this.prisma.withTenant((tx) => tx.adminUser.findUnique({ where: { id } }));
  }

  findByEmail(email: string): Promise<AdminUser | null> {
    const tenantId = getTenantId();
    return this.prisma.withTenant((tx) => tx.adminUser.findUnique({ where: { tenantId_email: { tenantId, email } } }));
  }

  list(): Promise<AdminUser[]> {
    return this.prisma.withTenant((tx) => tx.adminUser.findMany({ orderBy: { createdAt: 'asc' } }));
  }

  /** Only ADMIN/BRANCH_ADMIN are creatable via API (PRD A9 — OWNER is set at
   * tenant provisioning, see `TenantsRepository.create` + seed.ts). */
  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: Exclude<Role, 'OWNER'>;
    branchId: string | null;
  }): Promise<AdminUser> {
    return this.prisma.withTenant((tx) => tx.adminUser.create({ data: { tenantId: getTenantId(), ...data } }));
  }

  update(
    id: string,
    data: Partial<{ name: string; role: Exclude<Role, 'OWNER'>; branchId: string | null; passwordHash: string }>,
  ): Promise<AdminUser> {
    return this.prisma.withTenant((tx) => tx.adminUser.update({ where: { id }, data }));
  }

  setActive(id: string, isActive: boolean): Promise<AdminUser> {
    return this.prisma.withTenant((tx) => tx.adminUser.update({ where: { id }, data: { isActive } }));
  }
}
