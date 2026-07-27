import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createCourtBlockBodySchema,
  upsertCourtBodySchema,
  type Court as CourtDto,
  type CourtBlock as CourtBlockDto,
  type CreateCourtBlockBody,
  type LifecycleResult,
  type UpsertCourtBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminCatalogService } from './admin-catalog.service';

/**
 * Court + maintenance-block management (PRD A5). All three admin roles may
 * manage courts, but a Branch Admin is confined to their own branch's courts
 * (branch-scope enforced in `AdminCatalogService`, 403 BRANCH_SCOPE_DENIED).
 */
@Controller('admin/courts')
@UseGuards(AdminSessionGuard, RolesGuard)
export class AdminCourtsController {
  constructor(private readonly service: AdminCatalogService) {}

  @Get()
  list(@CurrentAdmin() admin: AdminAuthContext, @Query('branchId') branchId?: string): Promise<CourtDto[]> {
    return this.service.listCourts(admin.adminUser, branchId);
  }

  @Post()
  create(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(upsertCourtBodySchema)) body: UpsertCourtBody,
  ): Promise<CourtDto> {
    return this.service.createCourt(admin.adminUser, body);
  }

  @Get(':id')
  get(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<CourtDto> {
    return this.service.getCourt(admin.adminUser, id);
  }

  @Patch(':id')
  update(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertCourtBodySchema)) body: UpsertCourtBody,
  ): Promise<CourtDto> {
    return this.service.updateCourt(admin.adminUser, id, body);
  }

  @Delete(':id')
  remove(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.deleteCourt(admin.adminUser, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<LifecycleResult> {
    return this.service.deactivateCourt(admin.adminUser, id);
  }

  @Get(':id/blocks')
  listBlocks(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<CourtBlockDto[]> {
    return this.service.listBlocks(admin.adminUser, id);
  }

  @Post(':id/blocks')
  createBlock(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createCourtBlockBodySchema)) body: CreateCourtBlockBody,
  ): Promise<CourtBlockDto> {
    return this.service.createBlock(admin.adminUser, id, body);
  }

  @Delete(':id/blocks/:blockId')
  @HttpCode(204)
  async deleteBlock(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Param('blockId') blockId: string,
  ): Promise<void> {
    await this.service.deleteBlock(admin.adminUser, id, blockId);
  }
}
