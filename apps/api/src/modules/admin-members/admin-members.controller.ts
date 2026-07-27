import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  adminBlockMemberBodySchema,
  adminMemberListQuerySchema,
  paginationQuerySchema,
  type AdminBlockMemberBody,
  type AdminMemberListQuery,
  type BookingListItem,
  type MemberAdminView,
  type Paginated,
  type PaginationQuery,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminMembersService } from './admin-members.service';

/** Admin Member Management (PRD A7). All three admin roles; a Branch Admin is
 * confined to members with a booking at their own branch (service-enforced). */
@Controller('admin/members')
@UseGuards(AdminSessionGuard, RolesGuard)
export class AdminMembersController {
  constructor(private readonly service: AdminMembersService) {}

  @Get()
  list(
    @CurrentAdmin() admin: AdminAuthContext,
    @Query(new ZodValidationPipe(adminMemberListQuerySchema)) query: AdminMemberListQuery,
  ): Promise<Paginated<MemberAdminView>> {
    return this.service.list(admin.adminUser, query);
  }

  @Get(':id')
  detail(@CurrentAdmin() admin: AdminAuthContext, @Param('id') id: string): Promise<MemberAdminView> {
    return this.service.detail(admin.adminUser, id);
  }

  @Get(':id/bookings')
  bookings(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<BookingListItem>> {
    return this.service.bookings_(admin.adminUser, id, query);
  }

  @Post(':id/block')
  @HttpCode(200)
  block(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminBlockMemberBodySchema)) body: AdminBlockMemberBody,
  ): Promise<MemberAdminView> {
    return this.service.block(admin.adminUser, id, body);
  }
}
