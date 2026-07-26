import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  applyPromoBodySchema,
  cancellationRequestBodySchema,
  type ApplyPromoBody,
  type BookingDetail,
  type CancellationRequestBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { CurrentMember } from '../auth-member/current-member.decorator';
import type { MemberAuthContext } from '../auth-member/member-session.guard';
import { BookingService } from './booking.service';

/** Booking detail + client-side lifecycle actions (PRD C4.2/C4.3). All
 * routes fail-closed 404 for a booking the current Member does not own
 * (`BookingService` never leaks existence across members). */
@Controller('bookings')
@UseGuards(MemberSessionGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingService) {}

  @Get(':bookingId')
  async getBooking(
    @Param('bookingId') bookingId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
  ): Promise<BookingDetail> {
    return this.bookings.getBookingDetail(bookingId, memberAuth.memberId);
  }

  @Post(':bookingId/promotion')
  @HttpCode(200)
  async applyPromo(
    @Param('bookingId') bookingId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
    @Body(new ZodValidationPipe(applyPromoBodySchema)) body: ApplyPromoBody,
  ): Promise<BookingDetail> {
    return this.bookings.applyPromo(bookingId, memberAuth.memberId, body.code);
  }

  @Delete(':bookingId/promotion')
  @HttpCode(200)
  async removePromo(
    @Param('bookingId') bookingId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
  ): Promise<BookingDetail> {
    return this.bookings.removePromo(bookingId, memberAuth.memberId);
  }

  @Post(':bookingId/cancellation-request')
  @HttpCode(200)
  async requestCancellation(
    @Param('bookingId') bookingId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
    @Body(new ZodValidationPipe(cancellationRequestBodySchema)) body: CancellationRequestBody,
  ): Promise<BookingDetail> {
    return this.bookings.requestCancellation(bookingId, memberAuth.memberId, body.reason);
  }
}
