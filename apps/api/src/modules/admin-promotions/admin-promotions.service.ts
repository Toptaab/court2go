import { Injectable } from '@nestjs/common';
import {
  paginated,
  promotionSchema,
  promotionUsageItemSchema,
  type LifecycleResult,
  type PaginationQuery,
  type Paginated,
  type Promotion as PromotionDto,
  type PromotionUsageItem,
  type UpsertPromotionBody,
} from '@repo/types';
import type { AdminUser, Promotion } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { PromotionsRepository } from '../promotions/promotions.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';

function toPromotion(p: Promotion): PromotionDto {
  return promotionSchema.parse({
    id: p.id,
    code: p.code,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue,
    validFrom: p.validFrom.toISOString(),
    validUntil: p.validUntil.toISOString(),
    branchId: p.branchId,
    sportId: p.sportId,
    courtId: p.courtId,
    maxTotalUses: p.maxTotalUses,
    maxUsesPerMember: p.maxUsesPerMember,
    totalUses: p.totalUses,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  });
}

/**
 * Promotion management (PRD A6). Org-level (Owner/Admin). NOTE (contract/schema
 * gap, reported to lead): `Promotion` has no `deletedAt` column, so a
 * "soft-delete" here is a deactivation; the `LifecycleResult.deletedAt` on
 * DELETE is stamped with the action time to distinguish it from a plain
 * deactivate, but is not persisted.
 */
@Injectable()
export class AdminPromotionsService {
  constructor(
    private readonly promotions: PromotionsRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  async list(): Promise<PromotionDto[]> {
    return (await this.promotions.list()).map(toPromotion);
  }

  async create(admin: AdminUser, body: UpsertPromotionBody): Promise<PromotionDto> {
    const existing = await this.promotions.findByCode(body.code);
    if (existing) throw ApiError.validation('A promotion with this code already exists', { fieldErrors: { code: ['duplicate'] } });
    const promo = await this.promotions.create({
      code: body.code,
      description: body.description ?? null,
      discountType: body.discountType,
      discountValue: body.discountValue,
      validFrom: new Date(body.validFrom),
      validUntil: new Date(body.validUntil),
      branchId: body.branchId ?? null,
      sportId: body.sportId ?? null,
      courtId: body.courtId ?? null,
      maxTotalUses: body.maxTotalUses ?? null,
      maxUsesPerMember: body.maxUsesPerMember ?? null,
    });
    await this.record(admin, 'PROMOTION_CREATED', promo.id);
    return toPromotion(promo);
  }

  async update(admin: AdminUser, id: string, body: UpsertPromotionBody): Promise<PromotionDto> {
    const existing = await this.promotions.findById(id);
    if (!existing) throw ApiError.notFound('Promotion not found');
    if (body.code !== existing.code) {
      const clash = await this.promotions.findByCode(body.code);
      if (clash) throw ApiError.validation('A promotion with this code already exists', { fieldErrors: { code: ['duplicate'] } });
    }
    const promo = await this.promotions.update(id, {
      code: body.code,
      description: body.description ?? null,
      discountType: body.discountType,
      discountValue: body.discountValue,
      validFrom: new Date(body.validFrom),
      validUntil: new Date(body.validUntil),
      branchId: body.branchId ?? null,
      sportId: body.sportId ?? null,
      courtId: body.courtId ?? null,
      maxTotalUses: body.maxTotalUses ?? null,
      maxUsesPerMember: body.maxUsesPerMember ?? null,
    });
    await this.record(admin, 'PROMOTION_UPDATED', id);
    return toPromotion(promo);
  }

  async remove(admin: AdminUser, id: string): Promise<LifecycleResult> {
    const existing = await this.promotions.findById(id);
    if (!existing) throw ApiError.notFound('Promotion not found');
    const promo = await this.promotions.setActive(id, false);
    await this.record(admin, 'PROMOTION_DELETED', id);
    return { id: promo.id, isActive: promo.isActive, deletedAt: new Date().toISOString() };
  }

  async deactivate(admin: AdminUser, id: string): Promise<LifecycleResult> {
    const existing = await this.promotions.findById(id);
    if (!existing) throw ApiError.notFound('Promotion not found');
    const promo = await this.promotions.setActive(id, false);
    await this.record(admin, 'PROMOTION_DEACTIVATED', id);
    return { id: promo.id, isActive: promo.isActive, deletedAt: null };
  }

  async usage(id: string, query: PaginationQuery): Promise<Paginated<PromotionUsageItem>> {
    const existing = await this.promotions.findById(id);
    if (!existing) throw ApiError.notFound('Promotion not found');
    const all = await this.promotions.usageForPromotion(id);
    const skip = (query.page - 1) * query.pageSize;
    const pageRows = all.slice(skip, skip + query.pageSize);
    const items = pageRows.map((r) =>
      promotionUsageItemSchema.parse({
        bookingId: r.bookingId,
        memberId: r.memberId,
        memberPhone: r.member.phone,
        discountAmount: r.discountAmount,
        usedAt: r.usedAt.toISOString(),
      }),
    );
    return paginated(promotionUsageItemSchema).parse({
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: all.length,
      hasNextPage: skip + pageRows.length < all.length,
    });
  }

  private record(admin: AdminUser, action: string, entityId: string) {
    return this.audit.record({ actorType: 'ADMIN', actorId: admin.id, action, entityType: 'Promotion', entityId });
  }
}
