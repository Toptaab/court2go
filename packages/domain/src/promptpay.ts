/**
 * Dynamic PromptPay QR payload builder (ARCHITECTURE §4.3, PRD rev 6).
 * Pure, deterministic, EMVCo "Merchant Presented Mode" payload construction +
 * CRC16-CCITT checksum — no I/O, no network call, no external account. Wrapped
 * by `apps/api`'s `PromptPayAdapter` (`apps/api/src/integrations/adapters`),
 * which renders the returned payload string to a QR image via the `qrcode`
 * npm package. This module only produces the payload text.
 *
 * Field layout (canonical ascending EMVCo tag order):
 *   00  Payload Format Indicator          "01" (fixed)
 *   01  Point of Initiation Method        "12" (dynamic — a fixed amount is
 *                                          always encoded per booking, never
 *                                          "11"/static)
 *   29  Merchant Account Information (PromptPay), itself a nested TLV:
 *         00  Globally Unique Identifier  "A000000677010111" (PromptPay AID)
 *         01  Mobile number proxy         "0066" + last 9 digits (present iff
 *                                          the proxy id is a Thai mobile number)
 *         02  National ID / Tax ID proxy  the 13-digit id verbatim (present iff
 *                                          the proxy id is 13 digits)
 *   53  Transaction Currency              "764" (THB, ISO 4217 numeric)
 *   54  Transaction Amount                decimal baht, 2 dp (e.g. "100.00")
 *   58  Country Code                      "TH"
 *   63  CRC                               CRC16-CCITT (poly 0x1021, init
 *                                          0xFFFF) over every preceding byte
 *                                          INCLUDING this tag's own id+length
 *                                          ("6304"), rendered as 4 uppercase
 *                                          hex chars
 *
 * Every length prefix is exactly 2 ASCII digits (EMVCo TLV framing) — none of
 * our values ever exceed 99 chars, so this is never ambiguous.
 */

export interface BuildPromptPayPayloadInput {
  /** A Thai mobile number (any of `0812345678`, `081-234-5678`, `+66812345678`
   * — non-digits are stripped) OR a 13-digit National ID / Tax ID / e-Wallet
   * ID. This is `Branch.promptPayId` (packages/types, ARCHITECTURE §4.3). */
  promptPayId: string;
  /** THB amount in satang (integer) — the SAME unit as `Payment.amountDue`
   * (packages/types `thbAmountSchema`). Converted to a 2-decimal baht string
   * for EMVCo tag 54. */
  amountThb: number;
}

const PROMPTPAY_AID = 'A000000677010111';

/** 2-digit-length TLV encode: `tag` (2 chars) + zero-padded 2-digit length +
 * `value`. EMVCo framing — every field in this payload fits in 0-99 chars. */
function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

/**
 * Resolve a PromptPay proxy id to its EMVCo sub-tag + normalized value.
 *  - 13 digits            => National ID / Tax ID / e-Wallet ID, sub-tag "02", verbatim.
 *  - 10 digits, leads "0" => Thai mobile number (local format), sub-tag "01",
 *                            re-written as country-code "0066" + the trailing 9 digits.
 *  - 9 digits             => Thai mobile number already stripped of its leading
 *                            "0" (e.g. caller passed `812345678`), sub-tag "01".
 */
function normalizeProxyId(promptPayId: string): { subTag: '01' | '02'; value: string } {
  const digits = promptPayId.replace(/\D/g, '');

  if (digits.length === 13) {
    return { subTag: '02', value: digits };
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return { subTag: '01', value: `0066${digits.slice(1)}` };
  }
  if (digits.length === 9) {
    return { subTag: '01', value: `0066${digits}` };
  }
  // A `66`-prefixed international mobile number (e.g. "66812345678", 11 digits).
  if (digits.length === 11 && digits.startsWith('66')) {
    return { subTag: '01', value: `00${digits}` };
  }

  throw new Error(`Unsupported PromptPay proxy id: ${JSON.stringify(promptPayId)}`);
}

/**
 * CRC16-CCITT (poly `0x1021`, init `0xFFFF`, no final XOR) — the exact
 * variant EMVCo QR codes use for tag 63. Returns 4 uppercase hex chars,
 * zero-padded.
 */
export function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Build the EMVCo Merchant Presented Mode dynamic PromptPay payload string
 * for one booking's payment amount. Deterministic: same input always
 * produces the same output (no timestamp/nonce embedded — PromptPay QR codes
 * carry no idempotency key of their own; that's the Booking/Payment row's job).
 */
export function buildPromptPayPayload(input: BuildPromptPayPayloadInput): string {
  const { subTag, value } = normalizeProxyId(input.promptPayId);
  const merchantAccountInfo = tlv('00', PROMPTPAY_AID) + tlv(subTag, value);
  const amountDecimal = (input.amountThb / 100).toFixed(2);

  const withoutCrc =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('29', merchantAccountInfo) +
    tlv('53', '764') +
    tlv('54', amountDecimal) +
    tlv('58', 'TH') +
    '6304';

  return withoutCrc + crc16Ccitt(withoutCrc);
}
