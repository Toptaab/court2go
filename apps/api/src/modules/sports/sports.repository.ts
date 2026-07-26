import { Injectable } from '@nestjs/common';
import { Sport } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/** Sport (PRD §4, A3) — same deactivate-then-soft-delete pattern as Branch/Court. */
@Injectable()
export class SportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Sport | null> {
    return this.prisma.withTenant((tx) => tx.sport.findUnique({ where: { id } }));
  }

  listAdmin(): Promise<Sport[]> {
    return this.prisma.withTenant((tx) => tx.sport.findMany({ orderBy: { name: 'asc' } }));
  }

  /** Sports with >=1 active Court in the given (active) Branch — PRD C1.1 AC2. */
  listPublicForBranch(branchId: string): Promise<Sport[]> {
    return this.prisma.withTenant((tx) =>
      tx.sport.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          courts: { some: { branchId, isActive: true, deletedAt: null } },
        },
        orderBy: { name: 'asc' },
      }),
    );
  }

  create(name: string): Promise<Sport> {
    return this.prisma.withTenant((tx) => tx.sport.create({ data: { tenantId: getTenantId(), name } }));
  }

  update(id: string, name: string): Promise<Sport> {
    return this.prisma.withTenant((tx) => tx.sport.update({ where: { id }, data: { name } }));
  }

  setActive(id: string, isActive: boolean): Promise<Sport> {
    return this.prisma.withTenant((tx) => tx.sport.update({ where: { id }, data: { isActive } }));
  }

  softDelete(id: string): Promise<Sport> {
    return this.prisma.withTenant((tx) => tx.sport.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  hasFutureBookings(id: string): Promise<boolean> {
    return this.prisma
      .withTenant((tx) =>
        tx.booking.findFirst({
          where: {
            sportId: id,
            startsAt: { gte: new Date() },
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
          },
          select: { id: true },
        }),
      )
      .then((r) => r !== null);
  }
}
