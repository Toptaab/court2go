import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  paginationQuerySchema,
  upsertPromotionBodySchema,
  type LifecycleResult,
  type PaginationQuery,
  type Paginated,
  type Promotion as PromotionDto,
  type PromotionUsageItem,
  type UpsertPromotionBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { Roles } from '../auth-admin/roles.decorator';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminPromotionsService } from './admin-promotions.service';

/** Promotion management (PRD A6). Org-level: Owner/Admin only. */
@Controller('admin/promotions')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminPromotionsController {
  constructor(private readonly service: AdminPromotionsService) {}

  @Get()
  list(): Promise<PromotionDto[]> {
    return this.service.list();
  }

  @Post()
  create(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(upsertPromotionBodySchema)) body: UpsertPromotionBody,
  ): Promise<PromotionDto> {
    return this.service.create(admin.adminUser, body);
  }

  @Patch(':id')
  update(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertPromotionBodySchema)) body: UpsertPromotionBody,
  ): Promise<PromotionDto> {
    return this.service.update(admin.adminUser, id, body);
  }

  @Delete(':id')
  remove(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.remove(admin.adminUser, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.deactivate(admin.adminUser, id);
  }

  @Get(':id/usage')
  usage(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<PromotionUsageItem>> {
    return this.service.usage(id, query);
  }
}
