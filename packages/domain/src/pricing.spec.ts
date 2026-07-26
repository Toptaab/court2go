import type { AppliedPromotion, PeakTimeRange } from '@repo/types';
import { priceBreakdownSchema } from '@repo/types';
import { isPeakAtStart, peakPriceAtStart, priceForGridUnit, computePriceBreakdown } from './pricing';

const eveningPeak: PeakTimeRange = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Evening peak',
  days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  startTime: '08:30',
  endTime: '10:00',
  pricePerGridUnit: 100,
};

describe('isPeakAtStart', () => {
  it('is true when the start falls within [startTime, endTime) on a matching day', () => {
    expect(isPeakAtStart(540, 'MON', [eveningPeak])).toBe(true); // 09:00
  });

  it('is false when the start is before the range', () => {
    expect(isPeakAtStart(480, 'MON', [eveningPeak])).toBe(false); // 08:00
  });

  it('is false at the exact endTime boundary (half-open interval)', () => {
    expect(isPeakAtStart(600, 'MON', [eveningPeak])).toBe(false); // 10:00 === endTime
  });

  it('is true at the exact startTime boundary (inclusive)', () => {
    expect(isPeakAtStart(510, 'MON', [eveningPeak])).toBe(true); // 08:30 === startTime
  });

  it('is false when the day does not match the range', () => {
    expect(isPeakAtStart(540, 'SAT', [eveningPeak])).toBe(false);
  });

  it('is false with no peak ranges at all', () => {
    expect(isPeakAtStart(540, 'MON', [])).toBe(false);
  });
});

describe('priceForGridUnit / peakPriceAtStart', () => {
  it('returns the peak price when the unit is peak', () => {
    expect(priceForGridUnit(540, 'MON', 50, [eveningPeak])).toBe(100);
    expect(peakPriceAtStart(540, 'MON', [eveningPeak])).toBe(100);
  });

  it('returns the base price when the unit is not peak', () => {
    expect(priceForGridUnit(480, 'MON', 50, [eveningPeak])).toBe(50);
    expect(peakPriceAtStart(480, 'MON', [eveningPeak])).toBeNull();
  });
});

describe('computePriceBreakdown', () => {
  it('PRD A5.1 AC10: a 30-min-grid 3-slot run with 1 base unit + 2 peak units sums per-unit', () => {
    // Court opens 08:00; peak window 08:30-10:00 MON. Booking starts 08:00 for 3 x 30-min units:
    // unit 0 = 08:00 (base), unit 1 = 08:30 (peak), unit 2 = 09:00 (peak).
    const breakdown = computePriceBreakdown({
      gridIntervalMinutes: 30,
      slotCount: 3,
      startMinutes: 480,
      day: 'MON',
      basePricePerGridUnit: 50,
      peakTimeRanges: [eveningPeak],
    });

    expect(breakdown.units).toEqual([
      { index: 0, startTime: '08:00', isPeak: false, unitPrice: 50 },
      { index: 1, startTime: '08:30', isPeak: true, unitPrice: 100 },
      { index: 2, startTime: '09:00', isPeak: true, unitPrice: 100 },
    ]);
    expect(breakdown.subtotal).toBe(50 + 100 + 100);
    expect(breakdown.total).toBe(250);
    expect(breakdown.currency).toBe('THB');
    expect(breakdown.gridIntervalMinutes).toBe(30);
    expect(breakdown.slotCount).toBe(3);
    expect(breakdown.promotion).toBeNull();

    expect(() => priceBreakdownSchema.parse(breakdown)).not.toThrow();
  });

  it('prices an all-base booking when no peak range applies', () => {
    const breakdown = computePriceBreakdown({
      gridIntervalMinutes: 60,
      slotCount: 2,
      startMinutes: 360, // 06:00, well before the peak window
      day: 'MON',
      basePricePerGridUnit: 40,
      peakTimeRanges: [eveningPeak],
    });
    expect(breakdown.units.every((u) => !u.isPeak)).toBe(true);
    expect(breakdown.subtotal).toBe(80);
    expect(breakdown.total).toBe(80);
    priceBreakdownSchema.parse(breakdown);
  });

  it('prices an all-peak booking when every unit start is inside the range', () => {
    const breakdown = computePriceBreakdown({
      gridIntervalMinutes: 30,
      slotCount: 2,
      startMinutes: 510, // 08:30
      day: 'MON',
      basePricePerGridUnit: 40,
      peakTimeRanges: [eveningPeak],
    });
    expect(breakdown.units.every((u) => u.isPeak)).toBe(true);
    expect(breakdown.subtotal).toBe(200);
    priceBreakdownSchema.parse(breakdown);
  });

  it('charges base on a day the peak range does not cover', () => {
    const breakdown = computePriceBreakdown({
      gridIntervalMinutes: 30,
      slotCount: 1,
      startMinutes: 540, // 09:00, inside the window on a covered day
      day: 'SAT', // not in eveningPeak.days
      basePricePerGridUnit: 40,
      peakTimeRanges: [eveningPeak],
    });
    expect(breakdown.units[0]).toEqual({ index: 0, startTime: '09:00', isPeak: false, unitPrice: 40 });
  });

  it('subtracts a promotion discount from the subtotal', () => {
    const promotion: AppliedPromotion = {
      promotionId: '22222222-2222-4222-8222-222222222222',
      code: 'SAVE20',
      discountType: 'FIXED',
      discountValue: 2000,
      discountAmount: 30,
    };
    const breakdown = computePriceBreakdown({
      gridIntervalMinutes: 60,
      slotCount: 1,
      startMinutes: 360,
      day: 'MON',
      basePricePerGridUnit: 100,
      peakTimeRanges: [],
      promotion,
    });
    expect(breakdown.subtotal).toBe(100);
    expect(breakdown.promotion).toEqual(promotion);
    expect(breakdown.total).toBe(70);
    priceBreakdownSchema.parse(breakdown);
  });

  it('clamps total at 0 when the discount exceeds the subtotal', () => {
    const promotion: AppliedPromotion = {
      promotionId: '33333333-3333-4333-8333-333333333333',
      code: 'HUGE',
      discountType: 'FIXED',
      discountValue: 100000,
      discountAmount: 100000,
    };
    const breakdown = computePriceBreakdown({
      gridIntervalMinutes: 60,
      slotCount: 1,
      startMinutes: 360,
      day: 'MON',
      basePricePerGridUnit: 100,
      peakTimeRanges: [],
      promotion,
    });
    expect(breakdown.total).toBe(0);
    priceBreakdownSchema.parse(breakdown);
  });
});
