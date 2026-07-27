import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import {
  imageUploadUrlBodySchema,
  updateBrandingBodySchema,
  updateConfigBodySchema,
  type Branding,
  type Config,
  type ImageUploadUrlBody,
  type ImageUploadUrlResponse,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { Roles } from '../auth-admin/roles.decorator';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminConfigService } from './admin-config.service';

/** Tenant config / branding / uploads (PRD A8). Org-level: Owner/Admin only. */
@Controller('admin')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminConfigController {
  constructor(private readonly service: AdminConfigService) {}

  @Get('config')
  getConfig(): Promise<Config> {
    return this.service.getConfig();
  }

  @Put('config')
  updateConfig(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(updateConfigBodySchema)) body: Config,
  ): Promise<Config> {
    return this.service.updateConfig(admin.adminUser, body);
  }

  @Get('branding')
  getBranding(): Promise<Branding> {
    return this.service.getBranding();
  }

  @Put('branding')
  updateBranding(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(updateBrandingBodySchema)) body: Branding,
  ): Promise<Branding> {
    return this.service.updateBranding(admin.adminUser, body);
  }

  @Post('uploads/image-url')
  @HttpCode(200)
  createImageUploadUrl(
    @Body(new ZodValidationPipe(imageUploadUrlBodySchema)) body: ImageUploadUrlBody,
  ): Promise<ImageUploadUrlResponse> {
    return this.service.createImageUploadUrl(body);
  }
}
