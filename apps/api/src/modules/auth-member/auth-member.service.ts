import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import {
  otpRequestResponseSchema,
  memberSessionResponseSchema,
  lineLoginUrlResponseSchema,
  type OtpRequestBody,
  type OtpRequestResponse,
  type OtpVerifyBody,
  type MemberSessionResponse,
  type LineLoginUrlResponse,
  type LineCallbackBody,
} from '@repo/types';
import type { Config, Member } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { getTenantId } from '../../prisma/tenant-context';
import { OTP_SENDER } from '../../integrations/ports/otp-sender.port';
import type { OtpSender } from '../../integrations/ports/otp-sender.port';
import { LINE_CLIENT } from '../../integrations/ports/line-client.port';
import type { LineClient } from '../../integrations/ports/line-client.port';
import { MembersRepository } from '../members/members.repository';
import { mapMemberToMe } from '../members/member.mapper';
import { ConfigRepository } from '../config/config.repository';
import { OtpChallengesRepository } from './otp-challenges.repository';
import { ClientSessionsRepository } from './client-sessions.repository';
import { MEMBER_SESSION_COOKIE } from './member-session.guard';
import { generateOtpCode, hashOtpCode, otpCodeMatches, signLineState, verifyLineState } from './otp.util';

const HOUR_MS = 60 * 60 * 1000;

/**
 * True only in an explicitly dev/test environment. Deliberately fail-CLOSED:
 * an unset/unknown `NODE_ENV` is treated as production, so a prod deploy that
 * forgets to set `NODE_ENV` never leaks OTP `devCode` in the response nor
 * drops the `Secure` cookie flag. The dev server (`start:dev`) sets
 * `NODE_ENV=development` and Jest sets `NODE_ENV=test`, so dev ergonomics
 * (returned devCode, non-secure cookie over http://localhost) are preserved.
 */
function isDevLikeEnv(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'test';
}

/**
 * Member auth orchestration (PRD Epic C2, ARCHITECTURE §3.3/§4.1/§4.2):
 * phone+OTP login/bind and LINE login, both terminating in a DB-backed
 * `ClientSession` + `Set-Cookie c2g_member_session`.
 */
@Injectable()
export class AuthMemberService {
  constructor(
    private readonly members: MembersRepository,
    private readonly otpChallenges: OtpChallengesRepository,
    private readonly clientSessions: ClientSessionsRepository,
    private readonly configRepo: ConfigRepository,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
    @Inject(LINE_CLIENT) private readonly lineClient: LineClient,
  ) {}

  async requestOtp(body: OtpRequestBody, memberId: string | null): Promise<OtpRequestResponse> {
    const config = await this.getConfigOrThrow();

    if (body.purpose === 'BIND' && !memberId) {
      throw ApiError.unauthenticated('An active session is required to bind a phone number');
    }

    const now = new Date();
    await this.assertNotRateLimited(body.phone, config, now);

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(now.getTime() + config.otpExpiryMinutes * 60_000);

    const challenge = await this.otpChallenges.create({
      phone: body.phone,
      purpose: body.purpose,
      memberId: body.purpose === 'BIND' ? memberId : null,
      codeHash,
      expiresAt,
    });

    await this.otpSender.send(body.phone, code, body.purpose);

    const resendAvailableAt = new Date(challenge.createdAt.getTime() + config.otpResendCooldownSeconds * 1000);

    return otpRequestResponseSchema.parse({
      challengeId: challenge.id,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      devCode: isDevLikeEnv() ? code : null,
    });
  }

  async verifyOtp(
    body: OtpVerifyBody,
    res: Response,
    currentMemberId: string | null,
  ): Promise<MemberSessionResponse> {
    const config = await this.getConfigOrThrow();
    const challenge = await this.otpChallenges.findById(body.challengeId);
    if (!challenge) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'OTP_INVALID', 'OTP challenge not found');
    }

    const now = new Date();
    if (challenge.consumedAt !== null || challenge.expiresAt <= now) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'OTP_EXPIRED', 'This code has expired or already been used');
    }
    if (challenge.attempts >= config.otpMaxAttempts) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'OTP_MAX_ATTEMPTS', 'Maximum verification attempts exceeded');
    }

    if (!otpCodeMatches(body.code, challenge.codeHash)) {
      await this.otpChallenges.incrementAttempts(challenge.id);
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'OTP_INVALID', 'Incorrect code');
    }

    await this.otpChallenges.consume(challenge.id);

    let member: Member;
    if (challenge.purpose === 'LOGIN') {
      const existing = await this.members.findByPhone(challenge.phone);
      if (existing) {
        // Returning member (PRD C2.4 AC5) — ensure verified, since a
        // successful LOGIN OTP always leaves the Member phone-verified.
        member = existing.phoneVerified ? existing : await this.members.bindVerifiedPhone(existing.id, challenge.phone);
      } else {
        member = await this.members.createWithVerifiedPhone(challenge.phone);
      }
    } else {
      // BIND — the challenge was issued for a specific already-logged-in
      // Member (PRD C2.3); it must match the session presenting this code.
      if (!challenge.memberId || challenge.memberId !== currentMemberId) {
        throw ApiError.unauthenticated('This OTP challenge does not belong to the current session');
      }
      const conflicting = await this.members.findByPhone(challenge.phone);
      if (conflicting && conflicting.id !== challenge.memberId) {
        throw ApiError.conflict(
          'DUPLICATE_MEMBER',
          'This phone number is already registered to a different account',
        );
      }
      member = await this.members.bindVerifiedPhone(challenge.memberId, challenge.phone);
    }

    this.assertNotBlocked(member);
    const sessionExpiresAt = await this.mintSession(member.id, res, config);
    return memberSessionResponseSchema.parse({
      member: mapMemberToMe(member),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    });
  }

  async lineLoginUrl(): Promise<LineLoginUrlResponse> {
    const state = signLineState(getTenantId());
    return lineLoginUrlResponseSchema.parse({
      authorizationUrl: this.lineClient.buildAuthorizationUrl(state),
      state,
    });
  }

  async lineCallback(body: LineCallbackBody, res: Response): Promise<MemberSessionResponse> {
    if (!verifyLineState(body.state, getTenantId())) {
      throw ApiError.unauthenticated('Invalid or expired LINE login state');
    }

    const config = await this.getConfigOrThrow();
    const { lineUserId } = await this.lineClient.exchangeCode(body.code);

    let member = await this.members.findByLineUserId(lineUserId);
    if (!member) {
      member = await this.members.createFromLineLogin(lineUserId);
    }

    this.assertNotBlocked(member);
    const sessionExpiresAt = await this.mintSession(member.id, res, config);
    return memberSessionResponseSchema.parse({
      member: mapMemberToMe(member),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    });
  }

  async logout(sessionId: string, res: Response): Promise<void> {
    await this.clientSessions.revoke(sessionId);
    res.clearCookie(MEMBER_SESSION_COOKIE, { path: '/' });
  }

  /** PRD C2.5 AC3/AC5 — resend cooldown + rolling-hour send cap, both
   * Tenant-configurable (Config.otpResendCooldownSeconds/otpMaxSendsPerHour). */
  private async assertNotRateLimited(phone: string, config: Config, now: Date): Promise<void> {
    const mostRecent = await this.otpChallenges.mostRecentForPhone(phone);
    if (mostRecent) {
      const cooldownUntil = new Date(mostRecent.createdAt.getTime() + config.otpResendCooldownSeconds * 1000);
      if (cooldownUntil > now) {
        throw new ApiError(
          HttpStatus.TOO_MANY_REQUESTS,
          'OTP_RATE_LIMITED',
          'Please wait before requesting another code',
        );
      }
    }

    const since = new Date(now.getTime() - HOUR_MS);
    const recentCount = await this.otpChallenges.countRecentForPhone(phone, since);
    if (recentCount >= config.otpMaxSendsPerHour) {
      throw new ApiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'OTP_RATE_LIMITED',
        'Too many OTP requests for this phone number — try again later',
      );
    }
  }

  /**
   * A blocked Member (PRD A7.1 AC3) must not be able to establish a fresh
   * session, otherwise re-authenticating would defeat the admin block. Checked
   * at every session-mint path (OTP LOGIN/BIND, LINE callback) as
   * defense-in-depth alongside session revocation on block.
   */
  private assertNotBlocked(member: Member): void {
    if (member.isBlocked) {
      throw ApiError.forbidden('This account has been blocked', 'MEMBER_BLOCKED');
    }
  }

  private async mintSession(memberId: string, res: Response, config: Config): Promise<Date> {
    const durationMs = config.clientSessionDurationDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
    const session = await this.clientSessions.create(memberId, expiresAt);

    res.cookie(MEMBER_SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: !isDevLikeEnv(),
      path: '/',
      maxAge: durationMs,
    });

    return session.expiresAt;
  }

  private async getConfigOrThrow(): Promise<Config> {
    const config = await this.configRepo.get();
    if (!config) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Tenant configuration is missing');
    }
    return config;
  }
}
