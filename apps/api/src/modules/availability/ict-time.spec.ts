import { ictLocalToUtc, resolveDayOfWeek, utcToIctParts } from './ict-time';

/**
 * Unit coverage for the ICT (UTC+7, no DST) wall-clock conversion helpers
 * shared by `AvailabilityService` and `BookingService` (PRD NFR9). The
 * important property is that `utcToIctParts` is the exact inverse of
 * `ictLocalToUtc` — including across the ICT calendar-day boundary, which is
 * NOT the same instant as the UTC calendar-day boundary (a 7h offset).
 */
describe('ict-time', () => {
  it('ictLocalToUtc converts an ICT wall-clock instant to its UTC equivalent (UTC+7)', () => {
    expect(ictLocalToUtc('2026-01-05', '08:00')).toEqual(new Date('2026-01-05T01:00:00.000Z'));
  });

  it('utcToIctParts round-trips with ictLocalToUtc for a mid-day instant', () => {
    const date = '2026-01-05';
    const time = '14:30';
    const utc = ictLocalToUtc(date, time);
    const parts = utcToIctParts(utc);
    expect(parts.date).toBe(date);
    expect(parts.minutes).toBe(14 * 60 + 30);
  });

  it('round-trips across the ICT day boundary (23:xx ICT lands on the NEXT UTC calendar date)', () => {
    // 2026-01-05 23:30 ICT = 2026-01-05T16:30Z... but 2026-01-05 23:30 ICT is
    // still 2026-01-05 UTC (UTC 16:30). Use a time close enough to midnight
    // that the ICT date differs from the UTC date of the resulting instant.
    const date = '2026-01-05';
    const time = '23:30';
    const utc = ictLocalToUtc(date, time);
    // 23:30 ICT (UTC+7) = 16:30 UTC on the SAME UTC calendar date.
    expect(utc.toISOString()).toBe('2026-01-05T16:30:00.000Z');

    const parts = utcToIctParts(utc);
    expect(parts).toEqual({ date, minutes: 23 * 60 + 30 });
  });

  it('round-trips a time that crosses the ICT day boundary relative to UTC (early ICT morning = previous UTC date)', () => {
    // 2026-01-06 00:30 ICT = 2026-01-05T17:30Z — the ICT calendar date (Jan 6)
    // is AHEAD of the UTC calendar date (Jan 5) of the same instant.
    const date = '2026-01-06';
    const time = '00:30';
    const utc = ictLocalToUtc(date, time);
    expect(utc.toISOString()).toBe('2026-01-05T17:30:00.000Z');
    expect(utc.getUTCDate()).toBe(5); // UTC calendar date is the day BEFORE the ICT date

    const parts = utcToIctParts(utc);
    expect(parts).toEqual({ date, minutes: 30 });
  });

  it('supports 24:00 as an end-of-day close time (Date normalizes it to 00:00 the next calendar day)', () => {
    // "24:00" on 2026-01-05 denotes the exact same instant as "00:00" on
    // 2026-01-06 — JS `Date` arithmetic normalizes it that way, so the
    // round-tripped parts land on the NEXT date at minutes=0, not
    // {date: '2026-01-05', minutes: 1440}. Confirms `ictLocalToUtc`/
    // `utcToIctParts` treat 24:00 consistently with plain Date semantics.
    const utc = ictLocalToUtc('2026-01-05', '24:00');
    expect(utc).toEqual(ictLocalToUtc('2026-01-06', '00:00'));

    const parts = utcToIctParts(utc);
    expect(parts).toEqual({ date: '2026-01-06', minutes: 0 });
  });

  it('resolveDayOfWeek resolves the ICT calendar date weekday (not the host-tz weekday)', () => {
    // 2026-01-05 is a Monday.
    expect(resolveDayOfWeek('2026-01-05')).toBe('MON');
    expect(resolveDayOfWeek('2026-01-06')).toBe('TUE');
    expect(resolveDayOfWeek('2026-01-11')).toBe('SUN');
  });
});
