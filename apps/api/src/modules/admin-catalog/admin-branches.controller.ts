import { Body, Controller, Delete, Get, Param, Patch, Post, HttpCode, UseGuards } from '@nestjs/common';
import {
  upsertBranchBodySchema,
  type Branch as BranchDto,
  type LifecycleResult,
  type UpsertBranchBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { Roles } from '../auth-admin/roles.decorator';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminCatalogService } from './admin-catalog.service';

/** Branch management (PRD A4). Org-level: mutations are Owner/Admin only. */
@Controller('admin/branches')
@UseGuards(AdminSessionGuard, RolesGuard)
export class AdminBranchesController {
  constructor(private readonly service: AdminCatalogService) {}

  @Get()
  list(@CurrentAdmin() admin: AdminAuthContext): Promise<BranchDto[]> {
    return this.service.listBranches(admin.adminUser);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(upsertBranchBodySchema)) body: UpsertBranchBody,
  ): Promise<BranchDto> {
    return this.service.createBranch(admin.adminUser, body);
  }

  @Get(':id')
  get(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<BranchDto> {
    return this.service.getBranch(admin.adminUser, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertBranchBodySchema)) body: UpsertBranchBody,
  ): Promise<BranchDto> {
    return this.service.updateBranch(admin.adminUser, id, body);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  remove(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.deleteBranch(admin.adminUser, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  deactivate(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.deactivateBranch(admin.adminUser, id);
  }
}
