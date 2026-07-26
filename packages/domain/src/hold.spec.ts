import { HOLD_WINDOW_MINUTES, computeHoldExpiry, isHoldExpired, remainingHoldMs } from './hold';

describe('HOLD_WINDOW_MINUTES', () => {
  it('permits exactly 5 and 10 minutes', () => {
    expect(HOLD_WINDOW_MINUTES).toEqual([5, 10]);
  });
});

describe('computeHoldExpiry', () => {
  it('adds a 5-minute window', () => {
    const createdAt = new Date('2026-07-26T09:00:00.000Z');
    expect(computeHoldExpiry(createdAt, 5).toISOString()).toBe('2026-07-26T09:05:00.000Z');
  });

  it('adds a 10-minute window', () => {
    const createdAt = new Date('2026-07-26T09:00:00.000Z');
    expect(computeHoldExpiry(createdAt, 10).toISOString()).toBe('2026-07-26T09:10:00.000Z');
  });

  it('does not mutate the input Date', () => {
    const createdAt = new Date('2026-07-26T09:00:00.000Z');
    const before = createdAt.getTime();
    computeHoldExpiry(createdAt, 10);
    expect(createdAt.getTime()).toBe(before);
  });
});

describe('isHoldExpired', () => {
  const expiresAt = new Date('2026-07-26T09:05:00.000Z');

  it('is false strictly before expiry', () => {
    expect(isHoldExpired(expiresAt, new Date('2026-07-26T09:04:59.999Z'))).toBe(false);
  });

  it('is true exactly at the expiry instant', () => {
    expect(isHoldExpired(expiresAt, new Date('2026-07-26T09:05:00.000Z'))).toBe(true);
  });

  it('is true after expiry', () => {
    expect(isHoldExpired(expiresAt, new Date('2026-07-26T09:05:00.001Z'))).toBe(true);
  });
});

describe('remainingHoldMs', () => {
  const expiresAt = new Date('2026-07-26T09:05:00.000Z');

  it('returns the positive remaining ms before expiry', () => {
    expect(remainingHoldMs(expiresAt, new Date('2026-07-26T09:00:00.000Z'))).toBe(5 * 60_000);
  });

  it('floors at 0 exactly at expiry', () => {
    expect(remainingHoldMs(expiresAt, expiresAt)).toBe(0);
  });

  it('floors at 0 after expiry (never negative)', () => {
    expect(remainingHoldMs(expiresAt, new Date('2026-07-26T09:06:00.000Z'))).toBe(0);
  });
});
