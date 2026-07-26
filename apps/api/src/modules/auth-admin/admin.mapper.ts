import { adminUserSchema, type AdminUser as AdminUserDto } from '@repo/types';
import type { AdminUser } from '../../generated/prisma/client';

/**
 * Prisma `AdminUser` row → the `AdminUser`/`AdminMe` contract DTO
 * (ARCHITECTURE §3.1: map at the boundary, never leak Prisma types — and
 * never leak `passwordHash` — across the wire). Mirrors
 * `modules/members/member.mapper.ts`. Parses through `adminUserSchema`
 * before returning — fail loudly on contract drift.
 */
export function mapAdminUserToDto(adminUser: AdminUser): AdminUserDto {
  return adminUserSchema.parse({
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: adminUser.role,
    branchId: adminUser.branchId,
    isActive: adminUser.isActive,
    createdAt: adminUser.createdAt.toISOString(),
  });
}
