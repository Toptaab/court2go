import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES } from '@repo/types';
import { messageForError, parseErrorEnvelope } from './error';

describe('parseErrorEnvelope', () => {
  it('parses a well-formed envelope object', () => {
    const input = { error: { code: 'SLOT_UNAVAILABLE', message: 'Slot taken.' } };
    expect(parseErrorEnvelope(input)).toEqual(input);
  });

  it('parses a JSON-string envelope (fetch wrapper may throw the raw body)', () => {
    const input = JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    expect(parseErrorEnvelope(input)).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found.' },
    });
  });

  it('returns null for something that is not an envelope', () => {
    expect(parseErrorEnvelope({ foo: 'bar' })).toBeNull();
    expect(parseErrorEnvelope('not json')).toBeNull();
    expect(parseErrorEnvelope(undefined)).toBeNull();
    expect(parseErrorEnvelope(new Error('boom'))).toBeNull();
  });
});

describe('messageForError', () => {
  it('maps a known API_ERROR_CODES code to bilingual copy', () => {
    const err = { error: { code: API_ERROR_CODES.SLOT_UNAVAILABLE, message: 'ignored' } };
    const message = messageForError(err);
    expect(message).toContain('ช่วงเวลานี้เพิ่งถูกจองไป');
    expect(message).toContain('that slot was just taken');
  });

  it('falls back to the envelope message for an unrecognized-but-valid code', () => {
    // Simulates contract drift: a future code the map hasn't been updated for yet.
    const err = { error: { code: 'SOME_FUTURE_CODE', message: 'A brand new failure mode.' } };
    expect(messageForError(err)).toBe('A brand new failure mode.');
  });

  it('falls back to the generic bilingual message for non-envelope input', () => {
    const message = messageForError(new TypeError('network down'));
    expect(message).toContain('เกิดข้อผิดพลาด');
    expect(message).toContain('Something went wrong');
  });
});
