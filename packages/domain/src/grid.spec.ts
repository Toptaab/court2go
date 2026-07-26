import {
  LATTICE_MINUTES,
  timeToMinutes,
  minutesToTime,
  isGridAligned,
  gridStartMinutes,
  maxSlotsFromStart,
  latticeUnitsForBooking,
  expandToLattice,
  validateBookingSelection,
} from './grid';

describe('LATTICE_MINUTES', () => {
  it('is 30 (gcd of every allowed grid interval)', () => {
    expect(LATTICE_MINUTES).toBe(30);
  });
});

describe('timeToMinutes / minutesToTime', () => {
  it('converts ordinary times both ways', () => {
    expect(timeToMinutes('09:00')).toBe(540);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
    expect(minutesToTime(540)).toBe('09:00');
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('handles the "24:00" end-of-day close', () => {
    expect(timeToMinutes('24:00')).toBe(1440);
    expect(minutesToTime(1440)).toBe('24:00');
  });

  it('round-trips arbitrary minute values', () => {
    expect(minutesToTime(timeToMinutes('08:30'))).toBe('08:30');
  });
});

describe('isGridAligned', () => {
  it('is true when the offset from open is an exact multiple of the grid interval', () => {
    // open 08:30 (510), grid 60 -> 09:30 (570) aligned
    expect(isGridAligned(570, 510, 60)).toBe(true);
  });

  it('is false when the offset is not a multiple of the grid interval', () => {
    // open 08:30 (510), grid 60 -> 10:00 (600) is 90 min after open, not aligned
    expect(isGridAligned(600, 510, 60)).toBe(false);
  });

  it('is false before open (negative offset)', () => {
    expect(isGridAligned(480, 510, 60)).toBe(false);
  });

  it('supports 30/90/120 grids anchored to a non-midnight open', () => {
    expect(isGridAligned(480 + 30, 480, 30)).toBe(true);
    expect(isGridAligned(480 + 90, 480, 90)).toBe(true);
    expect(isGridAligned(480 + 120 * 2, 480, 120)).toBe(true);
    expect(isGridAligned(480 + 100, 480, 90)).toBe(false);
  });
});

describe('gridStartMinutes', () => {
  it('lists every start where a 1-slot booking still fits before close', () => {
    // open 08:00 (480), close 10:00 (600), grid 60 -> [08:00, 09:00]
    expect(gridStartMinutes(480, 600, 60)).toEqual([480, 540]);
  });

  it('handles a 24:00 close boundary', () => {
    // open 23:00 (1380), close 24:00 (1440), grid 30 -> [23:00, 23:30]
    expect(gridStartMinutes(1380, 1440, 30)).toEqual([1380, 1410]);
  });

  it('returns an empty array when nothing fits', () => {
    expect(gridStartMinutes(480, 500, 60)).toEqual([]);
  });
});

describe('maxSlotsFromStart', () => {
  it('is bounded by maxSlots when plenty of room remains before close', () => {
    // open..close spans 4 hours at a 60-min grid; maxSlots caps it at 2
    expect(maxSlotsFromStart(480, 720, 60, 2)).toBe(2);
  });

  it('is bounded by the closing time when maxSlots would overshoot', () => {
    // only 2 hours remain at a 60-min grid, maxSlots allows up to 5
    expect(maxSlotsFromStart(480, 600, 60, 5)).toBe(2);
  });

  it('returns 0 when a single slot does not fit', () => {
    expect(maxSlotsFromStart(580, 600, 60, 5)).toBe(0);
    expect(maxSlotsFromStart(600, 600, 60, 5)).toBe(0);
  });
});

describe('latticeUnitsForBooking', () => {
  it('decomposes slotCount x gridInterval into 30-min lattice units', () => {
    expect(latticeUnitsForBooking(3, 30)).toBe(3);
    expect(latticeUnitsForBooking(2, 60)).toBe(4);
    expect(latticeUnitsForBooking(1, 90)).toBe(3);
    expect(latticeUnitsForBooking(1, 120)).toBe(4);
  });
});

describe('expandToLattice', () => {
  it('expands a 3-slot 30-min-grid booking into 3 lattice rows', () => {
    const start = new Date('2026-07-26T08:00:00.000Z');
    const rows = expandToLattice(start, 3, 30);
    expect(rows).toHaveLength(3);
    expect(rows.map((d) => d.toISOString())).toEqual([
      '2026-07-26T08:00:00.000Z',
      '2026-07-26T08:30:00.000Z',
      '2026-07-26T09:00:00.000Z',
    ]);
    expect(rows[0]).not.toBe(start);
  });

  it('expands a 2-slot 60-min-grid booking into 4 lattice rows', () => {
    const start = new Date('2026-07-26T08:00:00.000Z');
    const rows = expandToLattice(start, 2, 60);
    expect(rows.map((d) => d.toISOString())).toEqual([
      '2026-07-26T08:00:00.000Z',
      '2026-07-26T08:30:00.000Z',
      '2026-07-26T09:00:00.000Z',
      '2026-07-26T09:30:00.000Z',
    ]);
  });

  it('expands a 1-slot 90-min-grid booking into 3 lattice rows', () => {
    const start = new Date('2026-07-26T08:00:00.000Z');
    const rows = expandToLattice(start, 1, 90);
    expect(rows.map((d) => d.toISOString())).toEqual([
      '2026-07-26T08:00:00.000Z',
      '2026-07-26T08:30:00.000Z',
      '2026-07-26T09:00:00.000Z',
    ]);
  });

  it('does not mutate the input Date', () => {
    const start = new Date('2026-07-26T08:00:00.000Z');
    const before = start.getTime();
    expandToLattice(start, 4, 60);
    expect(start.getTime()).toBe(before);
  });
});

describe('validateBookingSelection', () => {
  const base = { openMinutes: 480, closeMinutes: 600, gridInterval: 60 as const, maxSlots: 2 };

  it('accepts a valid selection', () => {
    expect(validateBookingSelection({ ...base, startMinutes: 480, slotCount: 2 })).toEqual({
      valid: true,
    });
  });

  it('rejects a non-integer or out-of-range slotCount', () => {
    expect(validateBookingSelection({ ...base, startMinutes: 480, slotCount: 0 })).toEqual({
      valid: false,
      reason: 'SLOT_COUNT_OUT_OF_RANGE',
    });
    expect(validateBookingSelection({ ...base, startMinutes: 480, slotCount: 3 })).toEqual({
      valid: false,
      reason: 'SLOT_COUNT_OUT_OF_RANGE',
    });
    expect(validateBookingSelection({ ...base, startMinutes: 480, slotCount: 1.5 })).toEqual({
      valid: false,
      reason: 'SLOT_COUNT_OUT_OF_RANGE',
    });
  });

  it('rejects a start before open', () => {
    expect(validateBookingSelection({ ...base, startMinutes: 420, slotCount: 1 })).toEqual({
      valid: false,
      reason: 'BEFORE_OPEN',
    });
  });

  it('rejects a start that is not grid-aligned', () => {
    expect(validateBookingSelection({ ...base, startMinutes: 490, slotCount: 1 })).toEqual({
      valid: false,
      reason: 'NOT_ALIGNED',
    });
  });

  it('rejects a grid-aligned start that is off the 30-min lock lattice', () => {
    // open 08:15 (495) is grid-aligned to itself (offset 0) but 495 % 30 !== 0,
    // so every derived lattice instant would fall off the platform :00/:30 lattice.
    expect(
      validateBookingSelection({
        openMinutes: 495,
        closeMinutes: 1440,
        gridInterval: 30,
        maxSlots: 2,
        startMinutes: 495,
        slotCount: 1,
      }),
    ).toEqual({ valid: false, reason: 'OFF_LATTICE' });
  });

  it('accepts an on-lattice start anchored to a 30-min-aligned open', () => {
    // open 08:30 (510) is on the lattice; a 60-min-grid start at 09:30 (570) is too.
    expect(
      validateBookingSelection({
        openMinutes: 510,
        closeMinutes: 720,
        gridInterval: 60,
        maxSlots: 3,
        startMinutes: 570,
        slotCount: 1,
      }),
    ).toEqual({ valid: true });
  });

  it('rejects a booking that would exceed closing time', () => {
    // start 09:00 (540), 2 slots x 60 min = ends 11:00, close is 10:00
    expect(validateBookingSelection({ ...base, startMinutes: 540, slotCount: 2 })).toEqual({
      valid: false,
      reason: 'EXCEEDS_CLOSING',
    });
  });

  it('handles a 24:00 close boundary', () => {
    const result = validateBookingSelection({
      openMinutes: 1380,
      closeMinutes: 1440,
      gridInterval: 30,
      maxSlots: 2,
      startMinutes: 1410,
      slotCount: 1,
    });
    expect(result).toEqual({ valid: true });
  });
});
