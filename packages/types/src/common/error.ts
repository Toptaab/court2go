import { z } from 'zod';

/**
 * Uniform error envelope, produced by the global NestJS exception filter
 * (ARCHITECTURE §3.4). EVERY non-2xx response has exactly this shape.
 */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    /** Stable machine-readable code (see `ApiErrorCode`). */
    code: z.string(),
    /** Human-readable, safe-to-display message. */
    message: z.string(),
    /** Optional structured detail (e.g. zod field errors). */
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/**
 * Canonical error codes. Clients switch on `error.code`, never on message text.
 * HTTP status shown for reference; the code is the contract.
 */
export const API_ERROR_CODES = {
  // 400
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  // 401
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  ADMIN_CREDENTIALS_INVALID: 'ADMIN_CREDENTIALS_INVALID',
  // 403
  FORBIDDEN: 'FORBIDDEN',
  BRANCH_SCOPE_DENIED: 'BRANCH_SCOPE_DENIED',
  MEMBER_BLOCKED: 'MEMBER_BLOCKED',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  OWNER_IMMUTABLE: 'OWNER_IMMUTABLE',
  // 404
  NOT_FOUND: 'NOT_FOUND',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  // 409
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  HOLD_EXPIRED: 'HOLD_EXPIRED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  DUPLICATE_MEMBER: 'DUPLICATE_MEMBER',
  SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS: 'SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS',
  PROMO_NOT_APPLICABLE: 'PROMO_NOT_APPLICABLE',
  CANCELLATION_CUTOFF_PASSED: 'CANCELLATION_CUTOFF_PASSED',
  // 413 / 415
  SLIP_UPLOAD_INVALID: 'SLIP_UPLOAD_INVALID',
  // 429
  RATE_LIMITED: 'RATE_LIMITED',
  // 500
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Field-level validation detail attached to VALIDATION_ERROR responses. */
export const validationDetailSchema = z.object({
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  formErrors: z.array(z.string()).optional(),
});
export type ValidationDetail = z.infer<typeof validationDetailSchema>;
