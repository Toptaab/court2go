import { Module } from '@nestjs/common';
import { ClientSessionsRepository } from '../auth-member/client-sessions.repository';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { MembersRepository } from './members.repository';
import { MeController } from './me.controller';

/**
 * Client profile module (PRD C6.1). `MemberSessionGuard` depends on
 * `ClientSessionsRepository` — Nest module providers are per-module (not
 * inherited transitively from `AuthMemberModule`'s DI container unless
 * imported), so both are re-provided here rather than importing the whole
 * auth-member module just for the guard.
 */
@Module({
  controllers: [MeController],
  providers: [MembersRepository, ClientSessionsRepository, MemberSessionGuard],
})
export class MembersModule {}
