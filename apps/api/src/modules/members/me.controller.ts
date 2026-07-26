import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { updateProfileBodySchema, type Me, type UpdateProfileBody } from '@repo/types';
import { ApiError } from '../../common/api-error';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { CurrentMember } from '../auth-member/current-member.decorator';
import type { MemberAuthContext } from '../auth-member/member-session.guard';
import { MembersRepository } from './members.repository';
import { mapMemberToMe } from './member.mapper';

/**
 * Client profile (PRD C6.1). Phone is NOT editable here — changing/adding a
 * phone goes through OTP BIND (`POST auth/otp/request` purpose=BIND, C6.1
 * AC4) to preserve phone-verification integrity; `updateProfileBodySchema`
 * has no phone field, so there is nothing to guard against beyond that.
 */
@Controller('me')
@UseGuards(MemberSessionGuard)
export class MeController {
  constructor(private readonly members: MembersRepository) {}

  @Get()
  async getMe(@CurrentMember() memberAuth: MemberAuthContext): Promise<Me> {
    const member = await this.members.findById(memberAuth.memberId);
    if (!member) throw ApiError.unauthenticated();
    return mapMemberToMe(member);
  }

  @Patch()
  async updateMe(
    @CurrentMember() memberAuth: MemberAuthContext,
    @Body(new ZodValidationPipe(updateProfileBodySchema)) body: UpdateProfileBody,
  ): Promise<Me> {
    const member = await this.members.updateProfile(memberAuth.memberId, {
      name: body.name,
      emergencyContact: body.emergencyContact,
      sex: body.sex,
    });
    return mapMemberToMe(member);
  }
}
