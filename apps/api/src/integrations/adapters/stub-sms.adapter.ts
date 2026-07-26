import { Injectable, Logger } from '@nestjs/common';
import type { OtpSender } from '../ports/otp-sender.port';

/**
 * StubSmsAdapter (ARCHITECTURE §4.1) — the MVP `OtpSender` implementation.
 * Logs the code (never throws — a logging/delivery hiccup must never break
 * the OTP flow in dev/MVP) instead of calling a real SMS gateway. No SMS
 * provider account is required to build/demo MVP (per HANDOFF).
 *
 * Returning the code to the CLIENT (the `devCode` field, non-prod only) is
 * the caller's (`AuthMemberService`) responsibility, not this adapter's —
 * this adapter's only job is "deliver the code", however that's observed.
 */
@Injectable()
export class StubSmsAdapter implements OtpSender {
  private readonly logger = new Logger('StubSmsAdapter');

  async send(phone: string, code: string, purpose: 'LOGIN' | 'BIND'): Promise<void> {
    this.logger.log(`[STUB SMS] purpose=${purpose} phone=${phone} code=${code}`);
  }
}
