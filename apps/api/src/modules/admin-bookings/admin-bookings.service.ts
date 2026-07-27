import { Injectable } from '@nestjs/common';
import {
  paginated,
  bookingListItemSchema,
  type AdminBookingListQuery,
  type AdminCalendarQuery,
  type AdminCancelBookingBody,
  type AdminCancellationDecisionBody,
  type AdminCreateBookingBody,
  type AdminModifyBookingBody,
  type AdminSetBookingOutcomeBody,
  type BookingDetail,
  type BookingListItem,
  type Paginated,
  type SlipViewUrlResponse,
} from '@repo/types';
import type { AdminUser } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { assertBranchScope } from '../auth-admin/branch-scope';
import { BookingsRepository } from '../bookings/bookings.repository';
import { ConfigRepository } from '../config/config.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { BookingService } from '../bookings/booking.service';
import { CourtsRepository } from '../courts/courts.repository';
import { PaymentService } from '../payments/payment.service';
import { mapToBookingDetail, mapToBookingListItem } from '../bookings/booking.mapper';

/**
 * Admin booking surface (PRD A1/A2, ARCHITECTURE §3.3/§6). Every route is
 * branch-scoped: Owner/Admin see the whole tenant; a Branch Admin is confined
 * to their own `branchId` — the list/calendar are force-narrowed, and every
 * by-id route asserts the loaded booking's branch via `assertBranchScope`
 * (403 BRANCH_SCOPE_DENIED). Walk-in creation and modify delegate to
 * `BookingService`'s authoritative pipeline; payment confirm/reject/slip-url
 * delegate to the M7 `PaymentService` methods. Audit rows on every state change.
 */
@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly config: ConfigRepository,
    private readonly audit: AuditLogRepository,
    private readonly bookingService: BookingService,
    private readonly courts: CourtsRepository,
    private readonly payments: PaymentService,
  ) {}

  /** Force a Branch Admin's effective branch filter to their own branch; leave
   * Owner/Admin's optional filter untouched. */
  private effectiveBranchId(admin: AdminUser, requested?: string): string | undefined {
    if (admin.role === 'BRANCH_ADMIN') return admin.branchId ?? '__no_branch__';
    return requested;
  }

  async list(admin: AdminUser, query: AdminBookingListQuery): Promise<Paginated<BookingListItem>> {
    const skip = (query.page - 1) * query.pageSize;
    const filters = {
      branchId: this.effectiveBranchId(admin, query.branchId),
      sportId: query.sportId,
      courtId: query.courtId,
      status: query.status,
      paymentStatus: query.paymentStatus,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : undefined,
      memberPhone: query.phone,
    };

    const [rows, total] = await Promise.all([
      this.bookings.listForAdmin({ ...filters, skip, take: query.pageSize }),
      this.bookings.countForAdmin(filters),
    ]);

    return paginated(bookingListItemSchema).parse({
      items: rows.map(mapToBookingListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNextPage: skip + rows.length < total,
    });
  }

  async calendar(admin: AdminUser, query: AdminCalendarQuery): Promise<BookingListItem[]> {
    const branchId = this.effectiveBranchId(admin, query.branchId) ?? query.branchId;
    assertBranchScope(admin, branchId);
    // ICT (UTC+7) local calendar day → UTC bounds (Thailand-only MVP, NFR9).
    const dayStart = new Date(`${query.date}T00:00:00+07:00`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const rows = await this.bookings.listForCalendar(branchId, dayStart, dayEnd);
    return rows.map(mapToBookingListItem);
  }

  async detail(admin: AdminUser, bookingId: string): Promise<BookingDetail> {
    const record = await this.loadScoped(admin, bookingId);
    return this.toDetail(record);
  }

  async createWalkIn(admin: AdminUser, body: AdminCreateBookingBody): Promise<BookingDetail> {
    const court = await this.courts.findById(body.courtId);
    if (!court || !court.isActive || court.deletedAt) throw ApiError.notFound('Court not found');
    assertBranchScope(admin, court.branchId);
    return this.bookingService.createWalkIn(body, admin.id);
  }

  async modify(admin: AdminUser, bookingId: string, body: AdminModifyBookingBody): Promise<BookingDetail> {
    const record = await this.loadScoped(admin, bookingId);
    // If the modify moves the booking to a different court, that court must also
    // be in the admin's branch scope.
    if (body.courtId && body.courtId !== record.courtId) {
      const target = await this.courts.findById(body.courtId);
      if (!target || !target.isActive || target.deletedAt) throw ApiError.notFound('Court not found');
      assertBranchScope(admin, target.branchId);
    }
    return this.bookingService.adminModify(record, body, admin.id);
  }

  async cancel(admin: AdminUser, bookingId: string, body: AdminCancelBookingBody): Promise<BookingDetail> {
    const record = await this.loadScoped(admin, bookingId);
    if (TERMINAL_STATUSES.includes(record.status)) {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'This booking is already in a terminal state');
    }
    await this.bookings.transitionStatus(bookingId, 'CANCELLED', {
      cancellationDecisionReason: body.reason ?? null,
    });
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'BOOKING_CANCELLED_BY_ADMIN',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: body.reason ? { reason: body.reason } : undefined,
    });
    return this.reloadDetail(admin, bookingId);
  }

  async outcome(admin: AdminUser, bookingId: string, body: AdminSetBookingOutcomeBody): Promise<BookingDetail> {
    const record = await this.loadScoped(admin, bookingId);
    if (record.status !== 'CONFIRMED') {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Only a Confirmed booking can be marked completed / no-show');
    }
    await this.bookings.transitionStatus(bookingId, body.outcome);
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: body.outcome === 'COMPLETED' ? 'BOOKING_COMPLETED' : 'BOOKING_NO_SHOW',
      entityType: 'Booking',
      entityId: bookingId,
    });
    return this.reloadDetail(admin, bookingId);
  }

  async cancellationDecision(
    admin: AdminUser,
    bookingId: string,
    body: AdminCancellationDecisionBody,
  ): Promise<BookingDetail> {
    const record = await this.loadScoped(admin, bookingId);
    if (record.status !== 'CANCELLATION_REQUESTED') {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'No pending cancellation request on this booking');
    }

    if (body.decision === 'APPROVE') {
      // Approve releases the grid (CANCELLED is in RELEASING_STATUSES) — the M6
      // carryover: slots stay held until the admin approves here.
      await this.bookings.transitionStatus(bookingId, 'CANCELLED', {
        cancellationDecisionReason: body.reason ?? null,
      });
    } else {
      // Decline restores the booking to CONFIRMED; slots were never released.
      await this.bookings.transitionStatus(bookingId, 'CONFIRMED', {
        cancellationDecisionReason: body.reason ?? null,
      });
    }

    await this.audit.record({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: body.decision === 'APPROVE' ? 'CANCELLATION_APPROVED' : 'CANCELLATION_DECLINED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: body.reason ? { reason: body.reason } : undefined,
    });
    return this.reloadDetail(admin, bookingId);
  }

  /* --------------------------------------------------------------- Payment review (M7 methods) */

  async confirmPayment(admin: AdminUser, bookingId: string, note?: string): Promise<BookingDetail> {
    await this.loadScoped(admin, bookingId);
    return this.payments.adminConfirmPayment(bookingId, admin.id, note);
  }

  async rejectPayment(admin: AdminUser, bookingId: string, reason: string): Promise<BookingDetail> {
    await this.loadScoped(admin, bookingId);
    return this.payments.adminRejectPayment(bookingId, admin.id, reason);
  }

  async slipUrl(admin: AdminUser, bookingId: string): Promise<SlipViewUrlResponse> {
    await this.loadScoped(admin, bookingId);
    return this.payments.issueSlipViewUrl(bookingId);
  }

  /* --------------------------------------------------------------- helpers */

  /** Load a booking (+payment+member) and enforce branch scope. Fails closed to
   * 404 for a missing booking; 403 BRANCH_SCOPE_DENIED for one in another branch. */
  private async loadScoped(admin: AdminUser, bookingId: string) {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record) throw ApiError.notFound('Booking not found');
    assertBranchScope(admin, record.branchId);
    return record;
  }

  private async reloadDetail(admin: AdminUser, bookingId: string): Promise<BookingDetail> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record) throw ApiError.notFound('Booking not found');
    return this.toDetail(record);
  }

  private async toDetail(
    record: NonNullable<Awaited<ReturnType<BookingsRepository['findByIdWithPayment']>>>,
  ): Promise<BookingDetail> {
    const config = await this.config.get();
    return mapToBookingDetail(record, record.payment, record.member, {
      now: new Date(),
      cancellationCutoffHours: config?.cancellationCutoffHours ?? 2,
      actor: 'ADMIN',
    });
  }
}

const TERMINAL_STATUSES: BookingDetail['status'][] = ['REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
