import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  otpRequestBodySchema,
  otpVerifyBodySchema,
  lineCallbackBodySchema,
  type OtpRequestBody,
  type OtpRequestResponse,
  type OtpVerifyBody,
  type MemberSessionResponse,
  type LineLoginUrlResponse,
  type LineCallbackBody,
} from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuthMemberService } from './auth-member.service';
import { ClientSessionsRepository } from './client-sessions.repository';
import { MemberSessionGuard, type RequestWithMemberAuth } from './member-session.guard';
import { resolveOptionalMemberId } from './current-member.decorator';

/**
 * Member auth (PRD Epic C2): phone+OTP login/bind and LINE login/callback,
 * plus logout. `otp/request` and `otp/verify` are reachable unauthenticated
 * (LOGIN purpose) so they don't use `MemberSessionGuard` — instead they
 * resolve an OPTIONAL current member from the session cookie, needed only
 * for the BIND purpose (PRD C2.3).
 */
@Controller('auth')
export class AuthMemberController {
  constructor(
    private readonly authMember: AuthMemberService,
    private readonly clientSessions: ClientSessionsRepository,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(
    @Body(new ZodValidationPipe(otpRequestBodySchema)) body: OtpRequestBody,
    @Req() req: Request,
  ): Promise<OtpRequestResponse> {
    const memberId = await resolveOptionalMemberId(req, this.clientSessions);
    return this.authMember.requestOtp(body, memberId);
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body(new ZodValidationPipe(otpVerifyBodySchema)) body: OtpVerifyBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MemberSessionResponse> {
    const memberId = await resolveOptionalMemberId(req, this.clientSessions);
    return this.authMember.verifyOtp(body, res, memberId);
  }

  @Post('line/login-url')
  @HttpCode(200)
  async lineLoginUrl(): Promise<LineLoginUrlResponse> {
    return this.authMember.lineLoginUrl();
  }

  @Post('line/callback')
  @HttpCode(200)
  async lineCallback(
    @Body(new ZodValidationPipe(lineCallbackBodySchema)) body: LineCallbackBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MemberSessionResponse> {
    return this.authMember.lineCallback(body, res);
  }

  @Post('logout')
  @UseGuards(MemberSessionGuard)
  @HttpCode(204)
  async logout(
    @Req() req: RequestWithMemberAuth,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authMember.logout(req.memberAuth!.sessionId, res);
  }
}
