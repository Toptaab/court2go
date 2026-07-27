import {
  API_ERROR_CODES,
  errorEnvelopeSchema,
  type ApiErrorCode,
  type ErrorEnvelope,
} from '@repo/types';
import { formatBilingual, type Bilingual } from './copy';

/**
 * Maps the API's uniform error envelope (`packages/types/src/common/error.ts`,
 * ARCHITECTURE §3.4: `{ error: { code, message, details? } }`) to a
 * user-facing UI message. This is the ONLY place `apps/web` interprets
 * `error.code` — components/hooks should call `messageForError`, never
 * switch on `error.code` themselves.
 *
 * `lib/api-client.ts` (M10.2) is responsible for what actually gets thrown
 * on a non-2xx response; `parseErrorEnvelope` accepts a few reasonable
 * shapes on purpose (a plain envelope object, a JSON string, or an
 * `Error` whose `.message` carries the JSON) so it isn't coupled to one
 * specific throw convention chosen later.
 */

/** Type guard / parser: `unknown` → `ErrorEnvelope`, or `null` if it doesn't fit. */
export function parseErrorEnvelope(input: unknown): ErrorEnvelope | null {
  const candidate = toEnvelopeCandidate(input);
  if (candidate === null) return null;
  const result = errorEnvelopeSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

function toEnvelopeCandidate(input: unknown): unknown {
  if (input !== null && typeof input === 'object' && 'error' in input) {
    return input;
  }
  const raw = typeof input === 'string' ? input : input instanceof Error ? input.message : null;
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Bilingual, friendly copy per `ApiErrorCode` (packages/types `API_ERROR_CODES`
 * — DO NOT invent codes here that don't exist there; TypeScript enforces this
 * map stays exhaustive as the contract grows new codes).
 */
const ERROR_COPY: Record<ApiErrorCode, Bilingual> = {
  [API_ERROR_CODES.VALIDATION_ERROR]: {
    th: 'กรุณาตรวจสอบข้อมูลที่กรอกแล้วลองอีกครั้ง',
    en: 'Please check the highlighted fields and try again.',
  },
  [API_ERROR_CODES.UNAUTHENTICATED]: {
    th: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ',
    en: 'Please log in to continue.',
  },
  [API_ERROR_CODES.OTP_INVALID]: {
    th: 'รหัส OTP ไม่ถูกต้อง',
    en: 'That code is incorrect.',
  },
  [API_ERROR_CODES.OTP_EXPIRED]: {
    th: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่',
    en: 'That code has expired — request a new one.',
  },
  [API_ERROR_CODES.OTP_MAX_ATTEMPTS]: {
    th: 'กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่',
    en: 'Too many incorrect attempts — request a new code.',
  },
  [API_ERROR_CODES.OTP_RATE_LIMITED]: {
    th: 'ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
    en: 'Too many requests — please wait before trying again.',
  },
  [API_ERROR_CODES.ADMIN_CREDENTIALS_INVALID]: {
    th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    en: 'Incorrect email or password.',
  },
  [API_ERROR_CODES.FORBIDDEN]: {
    th: 'คุณไม่มีสิทธิ์ดำเนินการนี้',
    en: "You don't have permission to do that.",
  },
  [API_ERROR_CODES.BRANCH_SCOPE_DENIED]: {
    th: 'รายการนี้อยู่นอกเหนือสิทธิ์การเข้าถึงสาขาของคุณ',
    en: "This is outside your branch's access.",
  },
  [API_ERROR_CODES.MEMBER_BLOCKED]: {
    th: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อสถานที่ให้บริการ',
    en: 'This account has been blocked. Please contact the venue.',
  },
  [API_ERROR_CODES.PHONE_NOT_VERIFIED]: {
    th: 'กรุณายืนยันหมายเลขโทรศัพท์เพื่อดำเนินการต่อ',
    en: 'Please verify your phone number to continue.',
  },
  [API_ERROR_CODES.OWNER_IMMUTABLE]: {
    th: 'ไม่สามารถแก้ไขหรือลบบัญชีเจ้าของได้',
    en: "The Owner account can't be changed or removed.",
  },
  [API_ERROR_CODES.NOT_FOUND]: {
    th: 'ไม่พบข้อมูลที่ต้องการ',
    en: "We couldn't find that.",
  },
  [API_ERROR_CODES.TENANT_NOT_FOUND]: {
    th: 'ไม่พบสถานที่ให้บริการนี้',
    en: "We couldn't find this venue.",
  },
  [API_ERROR_CODES.SLOT_UNAVAILABLE]: {
    th: 'ขออภัย ช่วงเวลานี้เพิ่งถูกจองไป กรุณาเลือกช่วงเวลาอื่น',
    en: 'Sorry, that slot was just taken. Please pick another.',
  },
  [API_ERROR_CODES.HOLD_EXPIRED]: {
    th: 'การจับจองหมดเวลาแล้ว กรุณาทำรายการใหม่อีกครั้ง',
    en: 'Your hold expired — please start the booking again.',
  },
  [API_ERROR_CODES.INVALID_STATE_TRANSITION]: {
    th: 'ไม่สามารถเปลี่ยนสถานะการจองนี้ได้จากสถานะปัจจุบัน',
    en: "This booking can't be updated from its current status.",
  },
  [API_ERROR_CODES.DUPLICATE_MEMBER]: {
    th: 'หมายเลขโทรศัพท์นี้ถูกยืนยันกับบัญชีอื่นแล้ว',
    en: 'This phone number is already verified on a different account.',
  },
  [API_ERROR_CODES.SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS]: {
    th: 'ไม่สามารถลบได้ เนื่องจากยังมีการจองในอนาคต',
    en: "This can't be removed — it still has upcoming bookings.",
  },
  [API_ERROR_CODES.PROMO_NOT_APPLICABLE]: {
    th: 'โค้ดโปรโมชั่นนี้ใช้ไม่ได้กับการจองนี้',
    en: "This promo code doesn't apply to this booking.",
  },
  [API_ERROR_CODES.CANCELLATION_CUTOFF_PASSED]: {
    th: 'ใกล้เวลาการจองเกินไป ไม่สามารถยกเลิกออนไลน์ได้',
    en: "It's too close to the start time to cancel online.",
  },
  [API_ERROR_CODES.SLIP_UPLOAD_INVALID]: {
    th: 'ไม่สามารถอัปโหลดไฟล์นี้ได้ กรุณาตรวจสอบชนิดและขนาดไฟล์',
    en: "That file couldn't be uploaded — check the format and size.",
  },
  [API_ERROR_CODES.RATE_LIMITED]: {
    th: 'มีการร้องขอบ่อยเกินไป กรุณาลองใหม่อีกครั้ง',
    en: 'Too many requests — please slow down and try again.',
  },
  [API_ERROR_CODES.INTERNAL_ERROR]: {
    th: 'เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง',
    en: 'Something went wrong on our end. Please try again.',
  },
};

/** Shown when the input isn't a recognizable error envelope at all (network failure, etc). */
const GENERIC_FALLBACK: Bilingual = {
  th: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
  en: 'Something went wrong. Please try again.',
};

/**
 * The one function UI code should call: `unknown` (whatever a failed fetch /
 * mutation threw) → a single display-ready string.
 *
 * Resolution order: known `error.code` → bilingual copy above; unrecognized
 * but well-formed envelope → the envelope's own `message` (server DTOs
 * document this as "safe to display"); anything else → generic fallback.
 */
export function messageForError(err: unknown): string {
  const envelope = parseErrorEnvelope(err);
  if (envelope) {
    const copy = ERROR_COPY[envelope.error.code as ApiErrorCode];
    if (copy) return formatBilingual(copy);
    if (envelope.error.message) return envelope.error.message;
  }
  return formatBilingual(GENERIC_FALLBACK);
}
