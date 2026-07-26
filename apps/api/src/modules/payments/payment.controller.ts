import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  confirmSlipBodySchema,
  slipUploadUrlBodySchema,
  type BookingDetail,
  type ConfirmSlipBody,
  type Payment,
  type SlipUploadUrlBody,
  type SlipUploadUrlResponse,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { CurrentMember } from '../auth-member/current-member.decorator';
import type { MemberAuthContext } from '../auth-member/member-session.guard';
import { PaymentService } from './payment.service';

/**
 * Client payment endpoints (PRD C3.1, ARCHITECTURE §4.3/§4.4). All routes
 * fail-closed 404 for a booking the current Member does not own
 * (`PaymentService` never leaks existence across members, mirroring
 * `BookingsController`). Both POSTs return `200`, not `201` (openapi.yaml).
 *
 * Admin confirm/reject/slip-view are deliberately NOT exposed here — see
 * `PaymentService`'s `adminConfirmPayment`/`adminRejectPayment`/
 * `issueSlipViewUrl` doc comments (TODO M8/M9: wire
 * `/admin/bookings/{id}/payment/{confirm,reject,slip-url}` behind
 * `AdminSessionGuard`+`RolesGuard`, which don't exist yet).
 */
@Controller('bookings/:bookingId/payment')
@UseGuards(MemberSessionGuard)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  async getPayment(
    @Param('bookingId') bookingId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
  ): Promise<Payment> {
    return this.payments.getPayment(bookingId, memberAuth.memberId);
  }

  @Post('slip-upload-url')
  @HttpCode(200)
  async getSlipUploadUrl(
    @Param('bookingId') bookingId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
    @Body(new ZodValidationPipe(slipUploadUrlBodySchema)) body: SlipUploadUrlBody,
  ): Promise<SlipUploadUrlResponse> {
    return this.payments.getSlipUploadUrl(bookingId, memberAuth.memberId, body);
  }

  @Post('slip')
  @HttpCode(200)
  async submitSlip(
    @Param('bookingId') bookingId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
    @Body(new ZodValidationPipe(confirmSlipBodySchema)) body: ConfirmSlipBody,
  ): Promise<BookingDetail> {
    return this.payments.submitSlip(bookingId, memberAuth.memberId, body);
  }
}
