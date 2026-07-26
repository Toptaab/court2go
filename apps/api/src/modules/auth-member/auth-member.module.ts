import { Module } from '@nestjs/common';
import { MembersRepository } from '../members/members.repository';
import { ConfigRepository } from '../config/config.repository';
import { OtpChallengesRepository } from './otp-challenges.repository';
import { ClientSessionsRepository } from './client-sessions.repository';
import { AuthMemberService } from './auth-member.service';
import { AuthMemberController } from './auth-member.controller';
import { MemberSessionGuard } from './member-session.guard';

/**
 * Member auth module (PRD Epic C2). `IntegrationsModule` is `@Global()` so
 * `OTP_SENDER`/`LINE_CLIENT` are available here without an explicit import.
 * Exports `MemberSessionGuard` (+ the repositories it depends on) so other
 * feature modules (e.g. `MembersModule`) can guard their own routes without
 * redeclaring the guard.
 */
@Module({
  controllers: [AuthMemberController],
  providers: [
    MembersRepository,
    OtpChallengesRepository,
    ClientSessionsRepository,
    ConfigRepository,
    AuthMemberService,
    MemberSessionGuard,
  ],
  exports: [MemberSessionGuard, ClientSessionsRepository, AuthMemberService],
})
export class AuthMemberModule {}
