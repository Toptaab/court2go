import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { myBookingsQuerySchema, type BookingListItem, type MyBookingsQuery, type Paginated } from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { CurrentMember } from '../auth-member/current-member.decorator';
import type { MemberAuthContext } from '../auth-member/member-session.guard';
import { BookingService } from './booking.service';

/**
 * Member booking history (PRD C5.1). Deliberately a separate controller
 * (`me/bookings`) from `MeController` (`me` — profile) so the two route
 * trees never clash, even though both sit under the `me` prefix.
 */
@Controller('me/bookings')
@UseGuards(MemberSessionGuard)
export class MeBookingsController {
  constructor(private readonly bookings: BookingService) {}

  @Get()
  async listMyBookings(
    @CurrentMember() memberAuth: MemberAuthContext,
    @Query(new ZodValidationPipe(myBookingsQuerySchema)) query: MyBookingsQuery,
  ): Promise<Paginated<BookingListItem>> {
    return this.bookings.listMyBookings(memberAuth.memberId, query);
  }
}
