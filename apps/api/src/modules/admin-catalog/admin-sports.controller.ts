import { Body, Controller, Delete, Get, Param, Patch, Post, HttpCode, UseGuards } from '@nestjs/common';
import {
  upsertSportBodySchema,
  type LifecycleResult,
  type Sport as SportDto,
  type UpsertSportBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { Roles } from '../auth-admin/roles.decorator';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminCatalogService } from './admin-catalog.service';

/** Sport management (PRD A3). Org-level: mutations are Owner/Admin only. */
@Controller('admin/sports')
@UseGuards(AdminSessionGuard, RolesGuard)
export class AdminSportsController {
  constructor(private readonly service: AdminCatalogService) {}

  @Get()
  list(): Promise<SportDto[]> {
    return this.service.listSports();
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(upsertSportBodySchema)) body: UpsertSportBody,
  ): Promise<SportDto> {
    return this.service.createSport(admin.adminUser, body);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertSportBodySchema)) body: UpsertSportBody,
  ): Promise<SportDto> {
    return this.service.updateSport(admin.adminUser, id, body);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  remove(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.deleteSport(admin.adminUser, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  deactivate(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.deactivateSport(admin.adminUser, id);
  }
}
