import { z } from 'zod';
import { idSchema, isoDateTimeSchema, thaiPhoneSchema } from '../common/index';
import { otpPurposeSchema } from '../enums/index';
import { meSchema } from '../entities/member';
import { adminMeSchema } from '../entities/admin-user';

/* =========================================================== Member: phone+OTP */

/**
 * Request an OTP (PRD C2.4). `purpose`:
 *  - LOGIN: phone+OTP login (creates/loads a Member, verifies phone, opens session).
 *  - BIND:  attach+verify a phone to the already-logged-in (LINE) Member (C2.3, C6.1 AC4).
 * BIND requires an active member session; LOGIN does not.
 */
export const otpRequestBodySchema = z.object({
  phone: thaiPhoneSchema,
  purpose: otpPurposeSchema,
});
export type OtpRequestBody = z.infer<typeof otpRequestBodySchema>;

export const otpRequestResponseSchema = z.object({
  challengeId: idSchema,
  expiresAt: isoDateTimeSchema,
  resendAvailableAt: isoDateTimeSchema,
  /**
   * DEV-ONLY convenience: the stub SMS adapter returns the code when
   * NODE_ENV !== 'production' (ARCHITECTURE §4.1). Always null/absent in prod.
   */
  devCode: z.string().nullable().optional(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

/** Verify an OTP (PRD C2.5). On success, Set-Cookie `c2g_member_session`. */
export const otpVerifyBodySchema = z.object({
  challengeId: idSchema,
  code: z.string().min(4).max(8),
});
export type OtpVerifyBody = z.infer<typeof otpVerifyBodySchema>;

/** Shared session-establishment result for any member login path. */
export const memberSessionResponseSchema = z.object({
  member: meSchema,
  sessionExpiresAt: isoDateTimeSchema,
});
export type MemberSessionResponse = z.infer<typeof memberSessionResponseSchema>;

/* =========================================================== Member: LINE login */

/** Kick off LINE OAuth (PRD C2.1 AC2). Returns the URL to redirect the user to. */
export const lineLoginUrlResponseSchema = z.object({
  authorizationUrl: z.string().url(),
  state: z.string(),
});
export type LineLoginUrlResponse = z.infer<typeof lineLoginUrlResponseSchema>;

/** LINE OAuth callback exchange (authorization-code flow, ARCHITECTURE §4.2). */
export const lineCallbackBodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type LineCallbackBody = z.infer<typeof lineCallbackBodySchema>;

/* =========================================================== Member: LINE OA linking */

/** Issue a signed link URL to bind LINE OA for notifications (ARCHITECTURE §4.2). */
export const lineOaLinkUrlResponseSchema = z.object({
  linkUrl: z.string().url(),
  expiresAt: isoDateTimeSchema,
});
export type LineOaLinkUrlResponse = z.infer<typeof lineOaLinkUrlResponseSchema>;

/* =========================================================== Admin: email+password */

/** Admin login (ADR-0005). On success, Set-Cookie `c2g_admin_session`. */
export const adminLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type AdminLoginBody = z.infer<typeof adminLoginBodySchema>;

export const adminSessionResponseSchema = z.object({
  admin: adminMeSchema,
  sessionExpiresAt: isoDateTimeSchema,
});
export type AdminSessionResponse = z.infer<typeof adminSessionResponseSchema>;
