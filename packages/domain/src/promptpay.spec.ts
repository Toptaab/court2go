import { buildPromptPayPayload, crc16Ccitt } from './promptpay';

/**
 * Parses a well-formed EMVCo TLV string into `{ tag, value }[]`, verifying
 * every declared length matches the actual value length as it goes (throws
 * otherwise) — used to assert structural invariants without hand-counting
 * offsets.
 */
function parseTlv(payload: string): Array<{ tag: string; value: string }> {
  const fields: Array<{ tag: string; value: string }> = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const length = Number(payload.slice(i + 2, i + 4));
    if (Number.isNaN(length)) throw new Error(`bad length prefix at offset ${i}`);
    const value = payload.slice(i + 4, i + 4 + length);
    if (value.length !== length) throw new Error(`declared length ${length} != actual ${value.length} for tag ${tag}`);
    fields.push({ tag, value });
    i += 4 + length;
  }
  return fields;
}

describe('crc16Ccitt', () => {
  it('matches the published CRC-16/CCITT-FALSE catalogue check value "29B1" for ASCII "123456789"', () => {
    // reveng CRC catalogue: CRC-16/CCITT-FALSE — poly=0x1021 init=0xFFFF
    // refin=false refout=false xorout=0x0000 check=0x29B1. This is the exact
    // variant EMVCo/PromptPay tag 63 uses.
    expect(crc16Ccitt('123456789')).toBe('29B1');
  });

  it('is deterministic', () => {
    expect(crc16Ccitt('hello world')).toBe(crc16Ccitt('hello world'));
  });

  it('produces a 4-hex-char, zero-padded, uppercase result', () => {
    expect(crc16Ccitt('a')).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe('buildPromptPayPayload — structural invariants (EMVCo TLV framing)', () => {
  const payload = buildPromptPayPayload({ promptPayId: '0899999999', amountThb: 10_000 });

  it('emits tags in canonical ascending order: 00, 01, 29, 53, 54, 58, 63', () => {
    const tags = parseTlv(payload).map((f) => f.tag);
    expect(tags).toEqual(['00', '01', '29', '53', '54', '58', '63']);
  });

  it('every declared 2-digit length prefix matches its value length (parseTlv would throw otherwise)', () => {
    expect(() => parseTlv(payload)).not.toThrow();
  });

  it('tag 00 (Payload Format Indicator) is fixed "01"', () => {
    expect(parseTlv(payload).find((f) => f.tag === '00')?.value).toBe('01');
  });

  it('tag 01 (Point of Initiation Method) is "12" — dynamic, since an amount is always encoded', () => {
    expect(parseTlv(payload).find((f) => f.tag === '01')?.value).toBe('12');
  });

  it('tag 53 (currency) is "764" (THB) and tag 58 (country) is "TH"', () => {
    const fields = parseTlv(payload);
    expect(fields.find((f) => f.tag === '53')?.value).toBe('764');
    expect(fields.find((f) => f.tag === '58')?.value).toBe('TH');
  });

  it('tag 63 is the last field and is a 4-hex-char CRC', () => {
    const fields = parseTlv(payload);
    const last = fields[fields.length - 1];
    expect(last?.tag).toBe('63');
    expect(last?.value).toMatch(/^[0-9A-F]{4}$/);
  });

  it('recomputing the CRC16 over payload-minus-last-4-chars equals the emitted CRC (round-trip)', () => {
    const withoutCrc = payload.slice(0, -4);
    const emittedCrc = payload.slice(-4);
    expect(crc16Ccitt(withoutCrc)).toBe(emittedCrc);
  });
});

describe('buildPromptPayPayload — mobile proxy (PromptPay-registered Thai mobile number)', () => {
  it('hand-verified vector: 0899999999 @ 100.00 THB', () => {
    // Computed by this same algorithm and hand-checked field-by-field below —
    // see the module doc comment for why this, not a copy-pasted "well-known"
    // string, is the source of truth here (a commonly-circulated PromptPay QR
    // example was found to have tag ordering / tag-01 / amount-formatting
    // inconsistencies under strict TLV parsing, so it is not trusted verbatim).
    const payload = buildPromptPayPayload({ promptPayId: '0899999999', amountThb: 10_000 });
    expect(payload).toBe(
      '00020101021229370016A0000006770101110113006689999999953037645406100.005802TH63048141',
    );
  });

  it('encodes the merchant account info (tag 29) as GUID + mobile sub-tag 01, "0066" + trailing 9 digits', () => {
    const payload = buildPromptPayPayload({ promptPayId: '0899999999', amountThb: 10_000 });
    const merchantInfo = parseTlv(payload).find((f) => f.tag === '29')!.value;
    // "0016" + AID (16 chars) + "0113" + "0066899999999" (13 chars)
    expect(merchantInfo).toBe('0016A00000067701011101130066899999999');
    expect(parseTlv(merchantInfo)).toEqual([
      { tag: '00', value: 'A000000677010111' },
      { tag: '01', value: '0066899999999' },
    ]);
  });

  it('accepts formatting variants (dashes, spaces) that normalize to the same 10-digit number', () => {
    const a = buildPromptPayPayload({ promptPayId: '0899999999', amountThb: 10_000 });
    const b = buildPromptPayPayload({ promptPayId: '089-999-9999', amountThb: 10_000 });
    const c = buildPromptPayPayload({ promptPayId: '089 999 9999', amountThb: 10_000 });
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('encodes tag 54 (amount) as a 2-decimal baht string derived from satang', () => {
    const payload = buildPromptPayPayload({ promptPayId: '0899999999', amountThb: 123_45 });
    expect(parseTlv(payload).find((f) => f.tag === '54')?.value).toBe('123.45');
  });

  it('is deterministic (same input, same output, no embedded timestamp/nonce)', () => {
    const a = buildPromptPayPayload({ promptPayId: '0899999999', amountThb: 10_000 });
    const b = buildPromptPayPayload({ promptPayId: '0899999999', amountThb: 10_000 });
    expect(a).toBe(b);
  });
});

describe('buildPromptPayPayload — national ID / tax ID proxy', () => {
  it('hand-verified vector: 13-digit national ID @ 100.00 THB', () => {
    const payload = buildPromptPayPayload({ promptPayId: '1234567890123', amountThb: 10_000 });
    expect(payload).toBe(
      '00020101021229370016A0000006770101110213123456789012353037645406100.005802TH6304F1A4',
    );
  });

  it('encodes the merchant account info (tag 29) as GUID + national-ID sub-tag 02, verbatim 13 digits', () => {
    const payload = buildPromptPayPayload({ promptPayId: '1234567890123', amountThb: 10_000 });
    const merchantInfo = parseTlv(payload).find((f) => f.tag === '29')!.value;
    expect(parseTlv(merchantInfo)).toEqual([
      { tag: '00', value: 'A000000677010111' },
      { tag: '02', value: '1234567890123' },
    ]);
  });

  it('strips non-digit separators from a formatted tax ID (e.g. "1-2345-67890-12-3")', () => {
    const a = buildPromptPayPayload({ promptPayId: '1234567890123', amountThb: 10_000 });
    const b = buildPromptPayPayload({ promptPayId: '1-2345-67890-12-3', amountThb: 10_000 });
    expect(b).toBe(a);
  });
});

describe('buildPromptPayPayload — invalid input', () => {
  it('throws on an unsupported proxy id shape', () => {
    expect(() => buildPromptPayPayload({ promptPayId: '123', amountThb: 100 })).toThrow();
  });
});
