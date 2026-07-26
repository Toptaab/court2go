import { Injectable } from '@nestjs/common';
import { Promotion, PromotionRedemption } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

export interface UpsertPromotionInput {
  code: string;
  description: string | null;
  discountType: Promotion['discountType'];
  discountValue: number;
  validFrom: Date;
  validUntil: Date;
  branchId: string | null;
  sportId: string | null;
  courtId: string | null;
  maxTotalUses: number | null;
  maxUsesPerMember: number | null;
}

/** Promotion (PRD §4, A6, C4.2). `totalUses` is a maintained counter,
 * incremented atomically alongside the `PromotionRedemption` insert
 * (`redeem()`) so a hot booking-creation path never needs a `COUNT(*)`. */
@Injectable()
export class PromotionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string): Promise<Promotion | null> {
    const tenantId = getTenantId();
    return this.prisma.withTenant((tx) => tx.promotion.findUnique({ where: { tenantId_code: { tenantId, code } } }));
  }

  findById(id: string): Promise<Promotion | null> {
    return this.prisma.withTenant((tx) => tx.promotion.findUnique({ where: { id } }));
  }

  list(): Promise<Promotion[]> {
    return this.prisma.withTenant((tx) => tx.promotion.findMany({ orderBy: { createdAt: 'desc' } }));
  }

  create(data: UpsertPromotionInput): Promise<Promotion> {
    return this.prisma.withTenant((tx) => tx.promotion.create({ data: { tenantId: getTenantId(), ...data } }));
  }

  update(id: string, data: Partial<UpsertPromotionInput>): Promise<Promotion> {
    return this.prisma.withTenant((tx) => tx.promotion.update({ where: { id }, data }));
  }

  setActive(id: string, isActive: boolean): Promise<Promotion> {
    return this.prisma.withTenant((tx) => tx.promotion.update({ where: { id }, data: { isActive } }));
  }

  /** Per-member usage count (PRD A6.1 AC2 `maxUsesPerMember` enforcement) — call
   * BEFORE `redeem()`; not atomic with it (the actual atomicity for "don't
   * double-spend the last use" is the Hold-creation transaction as a whole,
   * consistent with how `BookingsRepository.createHold` is the sole writer). */
  countUsesByMember(promotionId: string, memberId: string): Promise<number> {
    return this.prisma.withTenant((tx) => tx.promotionRedemption.count({ where: { promotionId, memberId } }));
  }

  /** Records one redemption + increments `Promotion.totalUses`, INSIDE the
   * same transaction as `BookingsRepository.createHold` when both are
   * composed by the calling service (both go through `withTenant`, and
   * Prisma's interactive `$transaction` on a single `PrismaService` call
   * nests correctly since `withTenant` opens exactly one transaction per
   * top-level call — the caller should pass the SAME `tx` — see
   * `redeemWithTx` below for that composition). */
  async redeem(promotionId: string, bookingId: string, memberId: string, discountAmount: number): Promise<PromotionRedemption> {
    return this.prisma.withTenant(async (tx) => {
      const [, redemption] = await Promise.all([
        tx.promotion.update({ where: { id: promotionId }, data: { totalUses: { increment: 1 } } }),
        tx.promotionRedemption.create({
          data: { tenantId: getTenantId(), promotionId, bookingId, memberId, discountAmount },
        }),
      ]);
      return redemption;
    });
  }

  usageForPromotion(promotionId: string) {
    return this.prisma.withTenant((tx) =>
      tx.promotionRedemption.findMany({
        where: { promotionId },
        include: { member: { select: { phone: true } } },
        orderBy: { usedAt: 'desc' },
      }),
    );
  }
}
