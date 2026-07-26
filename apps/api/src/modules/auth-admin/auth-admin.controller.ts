import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  adminLoginBodySchema,
  type AdminLoginBody,
  type AdminSessionResponse,
  type AdminUser as AdminUserDto,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuthAdminService } from './auth-admin.service';
import { AdminSessionGuard, type AdminAuthContext, type RequestWithAdminAuth } from './admin-session.guard';
import { CurrentAdmin } from './current-admin.decorator';

/** Admin auth (ADR-0005): email+password login/logout + "who am I". */
@Controller('admin')
export class AuthAdminController {
  constructor(private readonly authAdmin: AuthAdminService) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(adminLoginBodySchema)) body: AdminLoginBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminSessionResponse> {
    return this.authAdmin.login(body, res);
  }

  @Post('auth/logout')
  @UseGuards(AdminSessionGuard)
  @HttpCode(204)
  async logout(
    @Req() req: RequestWithAdminAuth,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authAdmin.logout(req.adminAuth!.sessionId, res);
  }

  @Get('me')
  @UseGuards(AdminSessionGuard)
  me(@CurrentAdmin() admin: AdminAuthContext): AdminUserDto {
    return this.authAdmin.me(admin.adminUser);
  }
}
