/**
 * OtpSender port (ARCHITECTURE §4.1). SMS is the sole OTP channel end-to-end
 * — there is deliberately no LINE-backed implementation of this interface,
 * which is how "OTP delivered via SMS only, never LINE OA" (PRD C2.4 AC2) is
 * enforced structurally rather than by a runtime check.
 *
 * Swapping providers (e.g. `OTP_PROVIDER=twilio`) is a new adapter class plus
 * one line in `IntegrationsModule`'s provider factory — no consumer code
 * (AuthMemberService) ever changes, because it only depends on this token.
 */
export interface OtpSender {
  send(phone: string, code: string, purpose: 'LOGIN' | 'BIND'): Promise<void>;
}

export const OTP_SENDER = Symbol('OtpSender');
