import { Injectable } from '@nestjs/common';
import { Member } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/**
 * Member (PRD §4). Unique on `(tenantId, phone)` — NOT global phone
 * uniqueness (ARCHITECTURE §2.3): looking up by phone is always implicitly
 * tenant-scoped through `withTenant()`, so the same phone naturally resolves
 * to independent rows across tenants without any special-casing here.
 */
@Injectable()
export class MembersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Member | null> {
    return this.prisma.withTenant((tx) => tx.member.findUnique({ where: { id } }));
  }

  findByPhone(phone: string): Promise<Member | null> {
    const tenantId = getTenantId();
    return this.prisma.withTenant((tx) => tx.member.findUnique({ where: { tenantId_phone: { tenantId, phone } } }));
  }

  findByLineUserId(lineUserId: string): Promise<Member | null> {
    const tenantId = getTenantId();
    return this.prisma.withTenant((tx) =>
      tx.member.findUnique({ where: { tenantId_lineUserId: { tenantId, lineUserId } } }),
    );
  }

  /** Phone+OTP LOGIN, phone never seen before for this Tenant (PRD C2.4 AC4) — creates a new, already-verified Member. */
  createWithVerifiedPhone(phone: string): Promise<Member> {
    return this.prisma.withTenant((tx) =>
      tx.member.create({ data: { tenantId: getTenantId(), phone, phoneVerified: true } }),
    );
  }

  /** LINE login, no existing Member for this `lineUserId` (PRD C2.1 AC2) — phone stays null/unverified. */
  createFromLineLogin(lineUserId: string): Promise<Member> {
    return this.prisma.withTenant((tx) => tx.member.create({ data: { tenantId: getTenantId(), lineUserId } }));
  }

  /** One-time phone bind for a LINE-login Member with no phone yet (PRD C2.3 AC2) —
   * permanently attaches + verifies the phone on the EXISTING Member row (no duplicate). */
  bindVerifiedPhone(memberId: string, phone: string): Promise<Member> {
    return this.prisma.withTenant((tx) =>
      tx.member.update({ where: { id: memberId }, data: { phone, phoneVerified: true } }),
    );
  }

  updateProfile(
    memberId: string,
    data: { name?: string | null; emergencyContact?: string | null; sex?: Member['sex'] },
  ): Promise<Member> {
    return this.prisma.withTenant((tx) => tx.member.update({ where: { id: memberId }, data }));
  }

  setLineOaBound(memberId: string, bound: boolean): Promise<Member> {
    return this.prisma.withTenant((tx) =>
      tx.member.update({ where: { id: memberId }, data: { lineBoundAt: bound ? new Date() : null } }),
    );
  }

  /** PRD A7.1 AC3 — block/unblock. Combined with immediate `ClientSession`
   * revocation by the calling service (blocking must take effect at once). */
  setBlocked(memberId: string, blocked: boolean, reason?: string): Promise<Member> {
    return this.prisma.withTenant((tx) =>
      tx.member.update({
        where: { id: memberId },
        data: { isBlocked: blocked, blockedReason: reason ?? null, blockedAt: blocked ? new Date() : null },
      }),
    );
  }

  /** Admin Member Management search (PRD A7.1 AC1) — by phone or name. */
  async listAdmin(opts: { q?: string; branchId?: string | null; skip: number; take: number }) {
    return this.prisma.withTenant((tx) =>
      tx.member.findMany({
        where: {
          ...(opts.q ? { OR: [{ phone: { contains: opts.q } }, { name: { contains: opts.q, mode: 'insensitive' } }] } : {}),
          // Branch Admin scoping (PRD A7.1 AC1): only Members with >=1 booking at their Branch.
          ...(opts.branchId ? { bookings: { some: { branchId: opts.branchId } } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
    );
  }
}
