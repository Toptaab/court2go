import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  paginationQuerySchema,
  upsertNewsBodySchema,
  type News as NewsDto,
  type PaginationQuery,
  type Paginated,
  type UpsertNewsBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { Roles } from '../auth-admin/roles.decorator';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminNewsService } from './admin-news.service';

/** Admin news management (PRD A10). Org-level: Owner/Admin only. */
@Controller('admin/news')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminNewsController {
  constructor(private readonly service: AdminNewsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery): Promise<Paginated<NewsDto>> {
    return this.service.list(query);
  }

  @Post()
  create(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(upsertNewsBodySchema)) body: UpsertNewsBody,
  ): Promise<NewsDto> {
    return this.service.create(admin.adminUser, body);
  }

  @Patch(':id')
  update(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertNewsBodySchema)) body: UpsertNewsBody,
  ): Promise<NewsDto> {
    return this.service.update(admin.adminUser, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<void> {
    await this.service.remove(admin.adminUser, id);
  }
}
