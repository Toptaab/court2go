import { Injectable } from '@nestjs/common';
import { Branch, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/** Branch (PRD §4, A4). Lifecycle is deactivate-then-soft-delete — soft
 * -delete eligibility (no future bookings) is a cross-table check owned by
 * BranchesService, not this repository. */
@Injectable()
export class BranchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Branch | null> {
    return this.prisma.withTenant((tx) => tx.branch.findUnique({ where: { id } }));
  }

  /** Active, non-deleted branches only — the client-facing selector (PRD C1.1 AC1). */
  listPublic(): Promise<Branch[]> {
    return this.prisma.withTenant((tx) =>
      tx.branch.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { name: 'asc' } }),
    );
  }

  /** All branches (any status) — Admin Console (PRD A4). `branchId` narrows
   * to a single branch (a BRANCH_ADMIN's own branch, mirroring
   * `CourtsRepository.listAdmin`'s scoping) — Owner/Admin pass none and see
   * every branch tenant-wide. */
  listAdmin(filters: { branchId?: string } = {}): Promise<Branch[]> {
    return this.prisma.withTenant((tx) =>
      tx.branch.findMany({
        where: filters.branchId ? { id: filters.branchId } : {},
        orderBy: { name: 'asc' },
      }),
    );
  }

  create(data: Omit<Prisma.BranchUncheckedCreateInput, 'id' | 'tenantId'>): Promise<Branch> {
    return this.prisma.withTenant((tx) => tx.branch.create({ data: { ...data, tenantId: getTenantId() } }));
  }

  update(id: string, data: Prisma.BranchUpdateInput): Promise<Branch> {
    return this.prisma.withTenant((tx) => tx.branch.update({ where: { id }, data }));
  }

  setActive(id: string, isActive: boolean): Promise<Branch> {
    return this.prisma.withTenant((tx) => tx.branch.update({ where: { id }, data: { isActive } }));
  }

  softDelete(id: string): Promise<Branch> {
    return this.prisma.withTenant((tx) => tx.branch.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  /** Used by BranchesService to enforce "soft-delete blocked while future
   * bookings exist" (PRD A4.1 AC4) before calling `softDelete`. */
  hasFutureBookings(id: string): Promise<boolean> {
    return this.prisma
      .withTenant((tx) =>
        tx.booking.findFirst({
          where: {
            branchId: id,
            startsAt: { gte: new Date() },
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
          },
          select: { id: true },
        }),
      )
      .then((r) => r !== null);
  }
}
