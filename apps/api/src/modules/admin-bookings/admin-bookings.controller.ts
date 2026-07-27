import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  adminBookingListQuerySchema,
  adminCalendarQuerySchema,
  adminCancelBookingBodySchema,
  adminCancellationDecisionBodySchema,
  adminConfirmPaymentBodySchema,
  adminCreateBookingBodySchema,
  adminModifyBookingBodySchema,
  adminRejectPaymentBodySchema,
  adminSetBookingOutcomeBodySchema,
  type AdminBookingListQuery,
  type AdminCalendarQuery,
  type AdminCancelBookingBody,
  type AdminCancellationDecisionBody,
  type AdminConfirmPaymentBody,
  type AdminCreateBookingBody,
  type AdminModifyBookingBody,
  type AdminRejectPaymentBody,
  type AdminSetBookingOutcomeBody,
  type BookingDetail,
  type BookingListItem,
  type Paginated,
  type SlipViewUrlResponse,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminSessionGuard } from '../auth-admin/admin-session.guard';
import { RolesGuard } from '../auth-admin/roles.guard';
import { CurrentAdmin } from '../auth-admin/current-admin.decorator';
import type { AdminAuthContext } from '../auth-admin/admin-session.guard';
import { AdminBookingsService } from './admin-bookings.service';

/**
 * Admin booking console (PRD A1/A2). Guarded by `AdminSessionGuard` (+ the
 * no-op `RolesGuard`; all three admin roles may manage bookings, differing only
 * by branch scope, which `AdminBookingsService` enforces per route).
 */
@Controller('admin/bookings')
@UseGuards(AdminSessionGuard, RolesGuard)
export class AdminBookingsController {
  constructor(private readonly service: AdminBookingsService) {}

  @Get()
  async list(
    @CurrentAdmin() admin: AdminAuthContext,
    @Query(new ZodValidationPipe(adminBookingListQuerySchema)) query: AdminBookingListQuery,
  ): Promise<Paginated<BookingListItem>> {
    return this.service.list(admin.adminUser, query);
  }

  @Get('calendar')
  async calendar(
    @CurrentAdmin() admin: AdminAuthContext,
    @Query(new ZodValidationPipe(adminCalendarQuerySchema)) query: AdminCalendarQuery,
  ): Promise<BookingListItem[]> {
    return this.service.calendar(admin.adminUser, query);
  }

  @Post()
  async createWalkIn(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body(new ZodValidationPipe(adminCreateBookingBodySchema)) body: AdminCreateBookingBody,
  ): Promise<BookingDetail> {
    return this.service.createWalkIn(admin.adminUser, body);
  }

  @Get(':bookingId')
  async detail(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
  ): Promise<BookingDetail> {
    return this.service.detail(admin.adminUser, bookingId);
  }

  @Patch(':bookingId')
  async modify(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(adminModifyBookingBodySchema)) body: AdminModifyBookingBody,
  ): Promise<BookingDetail> {
    return this.service.modify(admin.adminUser, bookingId, body);
  }

  @Post(':bookingId/cancel')
  @HttpCode(200)
  async cancel(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(adminCancelBookingBodySchema)) body: AdminCancelBookingBody,
  ): Promise<BookingDetail> {
    return this.service.cancel(admin.adminUser, bookingId, body);
  }

  @Post(':bookingId/outcome')
  @HttpCode(200)
  async outcome(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(adminSetBookingOutcomeBodySchema)) body: AdminSetBookingOutcomeBody,
  ): Promise<BookingDetail> {
    return this.service.outcome(admin.adminUser, bookingId, body);
  }

  @Post(':bookingId/cancellation-decision')
  @HttpCode(200)
  async cancellationDecision(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(adminCancellationDecisionBodySchema)) body: AdminCancellationDecisionBody,
  ): Promise<BookingDetail> {
    return this.service.cancellationDecision(admin.adminUser, bookingId, body);
  }

  @Post(':bookingId/payment/confirm')
  @HttpCode(200)
  async confirmPayment(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(adminConfirmPaymentBodySchema)) body: AdminConfirmPaymentBody,
  ): Promise<BookingDetail> {
    return this.service.confirmPayment(admin.adminUser, bookingId, body.note);
  }

  @Post(':bookingId/payment/reject')
  @HttpCode(200)
  async rejectPayment(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(adminRejectPaymentBodySchema)) body: AdminRejectPaymentBody,
  ): Promise<BookingDetail> {
    return this.service.rejectPayment(admin.adminUser, bookingId, body.reason);
  }

  @Get(':bookingId/payment/slip-url')
  async slipUrl(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('bookingId') bookingId: string,
  ): Promise<SlipViewUrlResponse> {
    return this.service.slipUrl(admin.adminUser, bookingId);
  }
}
