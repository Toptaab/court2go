import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createAdminUserBodySchema,
  updateAdminUserBodySchema,
  type AdminUser as AdminUserDto,
  type CreateAdminUserBody,
  type RolesMatrix,
  type UpdateAdminUserBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { Roles } from '../auth-admin/roles.decorator';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminUsersService } from './admin-users.service';

/**
 * AdminUser management + roles matrix (PRD A9, ADR-0005). Org-level: Owner/Admin
 * only. Owner-immunity / admin-removal rules are enforced in the service.
 */
@Controller('admin')
@UseGuards(AdminSessionGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get('admin-users')
  @Roles('OWNER', 'ADMIN')
  list(): Promise<AdminUserDto[]> {
    return this.service.list();
  }

  @Post('admin-users')
  @Roles('OWNER', 'ADMIN')
  create(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(createAdminUserBodySchema)) body: CreateAdminUserBody,
  ): Promise<AdminUserDto> {
    return this.service.create(admin.adminUser, body);
  }

  @Patch('admin-users/:id')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAdminUserBodySchema)) body: UpdateAdminUserBody,
  ): Promise<AdminUserDto> {
    return this.service.update(admin.adminUser, id, body);
  }

  @Delete('admin-users/:id')
  @HttpCode(204)
  @Roles('OWNER', 'ADMIN')
  async remove(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<void> {
    await this.service.remove(admin.adminUser, id);
  }

  @Get('roles-matrix')
  rolesMatrix(): RolesMatrix {
    return this.service.rolesMatrix();
  }
}
