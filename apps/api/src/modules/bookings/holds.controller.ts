import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { createHoldBodySchema, type CreateHoldBody, type CreateHoldResponse } from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { CurrentMember } from '../auth-member/current-member.decorator';
import type { MemberAuthContext } from '../auth-member/member-session.guard';
import { BookingService } from './booking.service';

/**
 * Hold creation (PRD C1.2, ARCHITECTURE §5.1). Requires an active Member
 * session — phone verification is NOT required to open a Hold itself (only
 * to advance past it, PRD C2.2/C2.3), so `MemberSessionGuard` alone (not a
 * phone-verified check) guards this route.
 */
@Controller('courts')
@UseGuards(MemberSessionGuard)
export class HoldsController {
  constructor(private readonly bookings: BookingService) {}

  @Post(':courtId/holds')
  async createHold(
    @Param('courtId') courtId: string,
    @CurrentMember() memberAuth: MemberAuthContext,
    @Body(new ZodValidationPipe(createHoldBodySchema)) body: CreateHoldBody,
  ): Promise<CreateHoldResponse> {
    return this.bookings.createHold(memberAuth.memberId, courtId, body);
  }
}
