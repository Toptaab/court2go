import { ApiError } from '../../common/api-error';
import type { CourtsRepository } from '../courts/courts.repository';
import type { ConfigRepository } from '../config/config.repository';
import type { MembersRepository } from '../members/members.repository';
import type { BranchesRepository } from '../branches/branches.repository';
import type { SportsRepository } from '../sports/sports.repository';
import type { PromotionsRepository } from '../promotions/promotions.repository';
import type { AuditLogRepository } from '../audit/audit-log.repository';
import type { Booking, Member, Payment, Promotion } from '../../generated/prisma/client';
import { BookingsRepository } from './bookings.repository';
import { SlotUnavailableError } from './errors';
import { BookingService } from './booking.service';

/**
 * Unit coverage for the Hold/Booking lifecycle orchestration (PRD C1.2/C4.2/
 * C4.3, ARCHITECTURE §5/§6) — the seam where grid validation, authoritative
 * server-side pricing, promo resolution and the verification-state fork all
 * combine. Repositories are fully mocked (plain jest mock objects); no DB.
 *
 * Thailand-only MVP fixed ICT (UTC+7) offset (PRD NFR9), duplicated here ONLY
 * to build UTC fixture instants — mirrors `availability.service.spec.ts`.
 */
const ICT_OFFSET_MINUTES = 420;
function ict(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - ICT_OFFSET_MINUTES * 60_000);
}

const COURT_ID = '00000000-0000-4000-8000-000000000001';
const BRANCH_ID = '00000000-0000-4000-8000-000000000002';
const SPORT_ID = '00000000-0000-4000-8000-000000000003';
const MEMBER_ID = '00000000-0000-4000-8000-000000000004';
const BOOKING_ID = '00000000-0000-4000-8000-000000000005';
const PROMO_ID = '00000000-0000-4000-8000-000000000006';
/** A Monday (verified against WEEKDAY_BY_JS_DAY, mirrors availability.service.spec.ts). */
const DATE = '2026-01-05';

function makeCourt(over: Record<string, unknown> = {}): any {
  return {
    id: COURT_ID,
    branchId: BRANCH_ID,
    sportId: SPORT_ID,
    isActive: true,
    deletedAt: null as Date | null,
    gridIntervalMinutes: 60,
    maxSlots: 3,
    basePricePerGridUnit: 10_000,
    name: 'Court 1',
    schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '10:00' }],
    peakTimeRanges: [] as unknown[],
    ...over,
  };
}

function makeBranch(over: Record<string, unknown> = {}): any {
  return {
    id: BRANCH_ID,
    name: 'Branch 1',
    paymentMethod: 'PAY_ONSITE',
    ...over,
  };
}

function makeSport(over: Record<string, unknown> = {}): any {
  return { id: SPORT_ID, name: 'Badminton', ...over };
}

function makeMember(over: Partial<Member> = {}): Member {
  return {
    id: MEMBER_ID,
    tenantId: 'tenant-1',
    phone: '0812345678',
    phoneVerified: true,
    name: null,
    emergencyContact: null,
    sex: null,
    lineUserId: null,
    lineBoundAt: null,
    isBlocked: false,
    blockedReason: null,
    blockedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as Member;
}

function makeConfig(over: Record<string, unknown> = {}): any {
  return {
    minBookingLeadTimeMinutes: 0,
    maxAdvanceBookingDays: 3650,
    holdWindowMinutes: 5,
    cancellationCutoffHours: 2,
    ...over,
  };
}

function makeBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: BOOKING_ID,
    tenantId: 'tenant-1',
    memberId: MEMBER_ID,
    courtId: COURT_ID,
    branchId: BRANCH_ID,
    sportId: SPORT_ID,
    branchName: 'Branch 1',
    sportName: 'Badminton',
    courtName: 'Court 1',
    branchPaymentMethod: 'PAY_ONSITE',
    status: 'PENDING_VERIFICATION',
    startsAt: ict(DATE, '08:00'),
    endsAt: ict(DATE, '09:00'),
    gridIntervalMinutes: 60,
    slotCount: 1,
    verifiedVia: 'SELF_OTP',
    isWalkIn: false,
    priceBreakdown: {
      currency: 'THB',
      gridIntervalMinutes: 60,
      slotCount: 1,
      units: [{ index: 0, startTime: '08:00', isPeak: false, unitPrice: 10_000 }],
      subtotal: 10_000,
      promotion: null,
      total: 10_000,
    } as any,
    subtotalAmount: 10_000,
    totalAmount: 10_000,
    appliedPromotionId: null,
    promotionDiscountAmount: null,
    holdExpiresAt: new Date(Date.now() + 5 * 60_000),
    cancellationRequestedAt: null,
    cancellationRequestReason: null,
    cancellationDecisionReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as Booking;
}

function makePayment(over: Partial<Payment> = {}): Payment {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    tenantId: 'tenant-1',
    bookingId: BOOKING_ID,
    status: 'PAY_ONSITE_NOT_COLLECTED',
    amountDue: 10_000,
    qrPayload: null,
    slipObjectKey: null,
    slipUploadedAt: null,
    reviewedByAdminId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as Payment;
}

function makePromo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: PROMO_ID,
    tenantId: 'tenant-1',
    code: 'SAVE10',
    description: null,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validUntil: new Date('2027-01-01T00:00:00.000Z'),
    branchId: null,
    sportId: null,
    courtId: null,
    maxTotalUses: null,
    maxUsesPerMember: null,
    totalUses: 0,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    ...over,
  } as Promotion;
}

function build() {
  const bookings = {
    createHold: jest.fn(),
    advanceOutOfVerification: jest.fn(),
    findById: jest.fn(),
    findByIdWithPayment: jest.fn(),
    transitionStatus: jest.fn(),
    updatePricing: jest.fn(),
    modifySlots: jest.fn(),
    findActiveSlots: jest.fn().mockResolvedValue([]),
    listForMember: jest.fn().mockResolvedValue([]),
    countForMember: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<BookingsRepository>;

  const courts = {
    findById: jest.fn(),
    listBlocksInRange: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<CourtsRepository>;

  const config = {
    get: jest.fn().mockResolvedValue(makeConfig()),
  } as unknown as jest.Mocked<ConfigRepository>;

  const members = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<MembersRepository>;

  const branches = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<BranchesRepository>;

  const sports = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<SportsRepository>;

  const promotions = {
    findByCode: jest.fn(),
    countUsesByMember: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<PromotionsRepository>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditLogRepository>;

  const service = new BookingService(bookings, courts, config, members, branches, sports, promotions, audit);
  return { service, bookings, courts, config, members, branches, sports, promotions, audit };
}

/** Wires up the "happy path" mocks for a createHold call (court/branch/sport/
 * member/config all resolve, no conflicting blocks/slots). Individual tests
 * override whichever piece they're targeting. */
function wireHappyPath(deps: ReturnType<typeof build>, over: { court?: any; branch?: any; member?: Member } = {}) {
  deps.courts.findById.mockResolvedValue(over.court ?? makeCourt());
  deps.branches.findById.mockResolvedValue(over.branch ?? makeBranch());
  deps.sports.findById.mockResolvedValue(makeSport());
  deps.members.findById.mockResolvedValue(over.member ?? makeMember());
  deps.config.get.mockResolvedValue(makeConfig());
}

describe('BookingService.createHold', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('court lookup', () => {
    it('404s when the court does not exist', async () => {
      const deps = build();
      deps.courts.findById.mockResolvedValue(null);
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 1 } as any),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('404s when the court is inactive (never leaked)', async () => {
      const deps = build();
      deps.courts.findById.mockResolvedValue(makeCourt({ isActive: false }));
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 1 } as any),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('404s when the court is soft-deleted', async () => {
      const deps = build();
      deps.courts.findById.mockResolvedValue(makeCourt({ deletedAt: new Date('2026-01-01') }));
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 1 } as any),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('selection validation (validateBookingSelection)', () => {
    it('400s a start that is off the fixed 30-min lattice (NOT_ALIGNED-style rejection)', async () => {
      const deps = build();
      wireHappyPath(deps, {
        court: makeCourt({
          gridIntervalMinutes: 60,
          schedule: [{ day: 'MON', closed: false, openTime: '08:15', closeTime: '10:00' }],
        }),
      });
      // 08:15 is grid-aligned to an 08:15 open, but not aligned to the fixed 30-min lattice.
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:15').toISOString(), slotCount: 1 } as any),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('400s a slotCount above maxSlots', async () => {
      const deps = build();
      wireHappyPath(deps, { court: makeCourt({ maxSlots: 1 }) });
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 2 } as any),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('400s a selection that exceeds closing time', async () => {
      const deps = build();
      wireHappyPath(deps, {
        court: makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 5,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '10:00' }],
        }),
      });
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '09:00').toISOString(), slotCount: 2 } as any),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('closed day', () => {
    it('409s SLOT_UNAVAILABLE when the schedule entry is closed', async () => {
      const deps = build();
      wireHappyPath(deps, {
        court: makeCourt({ schedule: [{ day: 'MON', closed: true, openTime: null, closeTime: null }] }),
      });
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 1 } as any),
      ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    });

    it('409s SLOT_UNAVAILABLE when there is no schedule entry at all for the weekday', async () => {
      const deps = build();
      wireHappyPath(deps, { court: makeCourt({ schedule: [] }) });
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 1 } as any),
      ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    });
  });

  describe('server-authoritative pricing (never trusts a client-sent price)', () => {
    it('sums base + peak pricing per grid unit and ignores any client-provided price', async () => {
      const deps = build();
      wireHappyPath(deps, {
        court: makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 2,
          basePricePerGridUnit: 10_000,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '10:00' }],
          peakTimeRanges: [
            { id: 'peak-1', label: 'Evening', days: ['MON'], startTime: '09:00', endTime: '10:00', pricePerGridUnit: 20_000 },
          ],
        }),
        member: makeMember({ phoneVerified: false }),
      });
      deps.bookings.createHold.mockImplementation(async (input: any) =>
        makeBooking({
          priceBreakdown: input.priceBreakdown,
          subtotalAmount: input.subtotalAmount,
          totalAmount: input.totalAmount,
          slotCount: input.slotCount,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        }),
      );

      // A 2-slot booking from 08:00 => base(08:00) + peak(09:00).
      const out = await deps.service.createHold(MEMBER_ID, COURT_ID, {
        start: ict(DATE, '08:00').toISOString(),
        slotCount: 2,
        // Client attempts to smuggle a fake price — must be ignored entirely.
        price: { total: 1 },
      } as any);

      expect(out.booking.price.subtotal).toBe(10_000 + 20_000);
      expect(out.booking.price.total).toBe(10_000 + 20_000);
      const persisted = deps.bookings.createHold.mock.calls[0][0];
      expect(persisted.subtotalAmount).toBe(30_000);
      expect(persisted.totalAmount).toBe(30_000);
    });
  });

  describe('slot conflict', () => {
    it('maps SlotUnavailableError from bookings.createHold to 409 SLOT_UNAVAILABLE', async () => {
      const deps = build();
      wireHappyPath(deps);
      deps.bookings.createHold.mockRejectedValue(new SlotUnavailableError(COURT_ID));
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 1 } as any),
      ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    });

    it('re-throws any other error from bookings.createHold unchanged', async () => {
      const deps = build();
      wireHappyPath(deps);
      const boom = new Error('boom');
      deps.bookings.createHold.mockRejectedValue(boom);
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, { start: ict(DATE, '08:00').toISOString(), slotCount: 1 } as any),
      ).rejects.toBe(boom);
    });
  });

  describe('verification-state fork', () => {
    it('phoneVerified=false stays PENDING_VERIFICATION, no Payment created, nextStep=VERIFY_PHONE', async () => {
      const deps = build();
      wireHappyPath(deps, { member: makeMember({ phoneVerified: false }) });
      deps.bookings.createHold.mockResolvedValue(makeBooking({ status: 'PENDING_VERIFICATION' }));

      const out = await deps.service.createHold(MEMBER_ID, COURT_ID, {
        start: ict(DATE, '08:00').toISOString(),
        slotCount: 1,
      } as any);

      expect(out.nextStep).toBe('VERIFY_PHONE');
      expect(out.booking.status).toBe('PENDING_VERIFICATION');
      expect(deps.bookings.advanceOutOfVerification).not.toHaveBeenCalled();
      // No real Payment row -> mapper synthesizes a provisional one; still
      // present in the DTO (contract requires non-nullable `payment`).
      expect(out.booking.payment).toBeDefined();
    });

    it('phoneVerified=true + QR_CODE branch advances to PENDING_PAYMENT with AWAITING_SLIP_UPLOAD, nextStep=UPLOAD_SLIP', async () => {
      const deps = build();
      wireHappyPath(deps, { branch: makeBranch({ paymentMethod: 'QR_CODE' }), member: makeMember({ phoneVerified: true }) });
      deps.bookings.createHold.mockResolvedValue(makeBooking({ status: 'PENDING_VERIFICATION', branchPaymentMethod: 'QR_CODE' }));
      deps.bookings.advanceOutOfVerification.mockResolvedValue({
        booking: makeBooking({ status: 'PENDING_PAYMENT', branchPaymentMethod: 'QR_CODE' }),
        payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      });

      const out = await deps.service.createHold(MEMBER_ID, COURT_ID, {
        start: ict(DATE, '08:00').toISOString(),
        slotCount: 1,
      } as any);

      expect(out.nextStep).toBe('UPLOAD_SLIP');
      expect(out.booking.status).toBe('PENDING_PAYMENT');
      expect(out.booking.payment.status).toBe('AWAITING_SLIP_UPLOAD');
      expect(deps.bookings.advanceOutOfVerification).toHaveBeenCalledWith(
        expect.objectContaining({ newStatus: 'PENDING_PAYMENT', payment: { status: 'AWAITING_SLIP_UPLOAD', amountDue: 10_000 } }),
      );
    });

    it('phoneVerified=true + PAY_ONSITE branch advances to CONFIRMED with PAY_ONSITE_NOT_COLLECTED, nextStep=CONFIRMED', async () => {
      const deps = build();
      wireHappyPath(deps, { branch: makeBranch({ paymentMethod: 'PAY_ONSITE' }), member: makeMember({ phoneVerified: true }) });
      deps.bookings.createHold.mockResolvedValue(makeBooking({ status: 'PENDING_VERIFICATION' }));
      deps.bookings.advanceOutOfVerification.mockResolvedValue({
        booking: makeBooking({ status: 'CONFIRMED' }),
        payment: makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' }),
      });

      const out = await deps.service.createHold(MEMBER_ID, COURT_ID, {
        start: ict(DATE, '08:00').toISOString(),
        slotCount: 1,
      } as any);

      expect(out.nextStep).toBe('CONFIRMED');
      expect(out.booking.status).toBe('CONFIRMED');
      expect(out.booking.payment.status).toBe('PAY_ONSITE_NOT_COLLECTED');
      expect(deps.bookings.advanceOutOfVerification).toHaveBeenCalledWith(
        expect.objectContaining({ newStatus: 'CONFIRMED', redeem: undefined }),
      );
    });

    it('redeems the applied promotion when the PAY_ONSITE branch confirms', async () => {
      const deps = build();
      wireHappyPath(deps, { branch: makeBranch({ paymentMethod: 'PAY_ONSITE' }), member: makeMember({ phoneVerified: true }) });
      deps.promotions.findByCode.mockResolvedValue(makePromo());
      deps.bookings.createHold.mockResolvedValue(makeBooking({ status: 'PENDING_VERIFICATION' }));
      deps.bookings.advanceOutOfVerification.mockResolvedValue({
        booking: makeBooking({ status: 'CONFIRMED' }),
        payment: makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' }),
      });

      await deps.service.createHold(MEMBER_ID, COURT_ID, {
        start: ict(DATE, '08:00').toISOString(),
        slotCount: 1,
        promoCode: 'SAVE10',
      } as any);

      expect(deps.bookings.advanceOutOfVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          redeem: { promotionId: PROMO_ID, memberId: MEMBER_ID, discountAmount: 1_000 },
        }),
      );
    });
  });

  describe('promoCode resolution', () => {
    it('applies a valid promo discount to the total', async () => {
      const deps = build();
      wireHappyPath(deps, { member: makeMember({ phoneVerified: false }) });
      deps.promotions.findByCode.mockResolvedValue(makePromo({ discountType: 'PERCENTAGE', discountValue: 10 }));
      deps.bookings.createHold.mockImplementation(async (input: any) =>
        makeBooking({ priceBreakdown: input.priceBreakdown, totalAmount: input.totalAmount, subtotalAmount: input.subtotalAmount }),
      );

      const out = await deps.service.createHold(MEMBER_ID, COURT_ID, {
        start: ict(DATE, '08:00').toISOString(),
        slotCount: 1,
        promoCode: 'SAVE10',
      } as any);

      expect(out.booking.price.subtotal).toBe(10_000);
      expect(out.booking.price.total).toBe(9_000);
      expect(out.booking.price.promotion).toMatchObject({ promotionId: PROMO_ID, discountAmount: 1_000 });
    });

    it('409s PROMO_NOT_APPLICABLE for an unknown code', async () => {
      const deps = build();
      wireHappyPath(deps);
      deps.promotions.findByCode.mockResolvedValue(null);
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, {
          start: ict(DATE, '08:00').toISOString(),
          slotCount: 1,
          promoCode: 'NOPE',
        } as any),
      ).rejects.toMatchObject({ code: 'PROMO_NOT_APPLICABLE' });
    });

    it('409s PROMO_NOT_APPLICABLE for an expired promo', async () => {
      const deps = build();
      wireHappyPath(deps);
      deps.promotions.findByCode.mockResolvedValue(makePromo({ validUntil: new Date('2024-01-01T00:00:00.000Z') }));
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, {
          start: ict(DATE, '08:00').toISOString(),
          slotCount: 1,
          promoCode: 'SAVE10',
        } as any),
      ).rejects.toMatchObject({ code: 'PROMO_NOT_APPLICABLE' });
    });

    it('409s PROMO_NOT_APPLICABLE once the total-uses cap is reached', async () => {
      const deps = build();
      wireHappyPath(deps);
      deps.promotions.findByCode.mockResolvedValue(makePromo({ maxTotalUses: 5, totalUses: 5 }));
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, {
          start: ict(DATE, '08:00').toISOString(),
          slotCount: 1,
          promoCode: 'SAVE10',
        } as any),
      ).rejects.toMatchObject({ code: 'PROMO_NOT_APPLICABLE' });
    });

    it('409s PROMO_NOT_APPLICABLE once the per-member cap is reached', async () => {
      const deps = build();
      wireHappyPath(deps);
      deps.promotions.findByCode.mockResolvedValue(makePromo({ maxUsesPerMember: 1 }));
      deps.promotions.countUsesByMember.mockResolvedValue(1);
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, {
          start: ict(DATE, '08:00').toISOString(),
          slotCount: 1,
          promoCode: 'SAVE10',
        } as any),
      ).rejects.toMatchObject({ code: 'PROMO_NOT_APPLICABLE' });
    });

    it('409s PROMO_NOT_APPLICABLE on a scope mismatch (wrong court)', async () => {
      const deps = build();
      wireHappyPath(deps);
      deps.promotions.findByCode.mockResolvedValue(makePromo({ courtId: 'some-other-court' }));
      await expect(
        deps.service.createHold(MEMBER_ID, COURT_ID, {
          start: ict(DATE, '08:00').toISOString(),
          slotCount: 1,
          promoCode: 'SAVE10',
        } as any),
      ).rejects.toMatchObject({ code: 'PROMO_NOT_APPLICABLE' });
    });
  });
});

describe('BookingService.getBookingDetail', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-05T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('404s when the booking does not exist (no existence leak)', async () => {
    const deps = build();
    deps.bookings.findById.mockResolvedValue(null);
    deps.bookings.findByIdWithPayment.mockResolvedValue(null);
    await expect(deps.service.getBookingDetail(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('404s when the booking belongs to a different member (no existence leak)', async () => {
    const deps = build();
    deps.bookings.findById.mockResolvedValue(null);
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ memberId: 'someone-else' }),
      payment: null,
      member: makeMember({ id: 'someone-else' }),
    } as any);
    await expect(deps.service.getBookingDetail(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('advances a PENDING_VERIFICATION booking on read once the member has completed OTP', async () => {
    const deps = build();
    const pending = makeBooking({ status: 'PENDING_VERIFICATION', holdExpiresAt: new Date(Date.now() + 60_000) });
    deps.bookings.findById.mockResolvedValue(pending);
    deps.members.findById.mockResolvedValue(makeMember({ phoneVerified: true }));
    deps.bookings.advanceOutOfVerification.mockResolvedValue({
      booking: makeBooking({ status: 'CONFIRMED' }),
      payment: makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' }),
    });
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'CONFIRMED' }),
      payment: makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' }),
      member: makeMember({ phoneVerified: true }),
    } as any);

    const detail = await deps.service.getBookingDetail(BOOKING_ID, MEMBER_ID);

    expect(deps.bookings.advanceOutOfVerification).toHaveBeenCalledTimes(1);
    expect(detail.status).toBe('CONFIRMED');
  });

  it('transitions an expired hold to EXPIRED on read', async () => {
    const deps = build();
    const pending = makeBooking({ status: 'PENDING_VERIFICATION', holdExpiresAt: new Date(Date.now() - 1000) });
    deps.bookings.findById.mockResolvedValue(pending);
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'EXPIRED' }),
      payment: null,
      member: makeMember(),
    } as any);

    const detail = await deps.service.getBookingDetail(BOOKING_ID, MEMBER_ID);

    expect(deps.bookings.transitionStatus).toHaveBeenCalledWith(BOOKING_ID, 'EXPIRED');
    expect(deps.bookings.advanceOutOfVerification).not.toHaveBeenCalled();
    expect(detail.status).toBe('EXPIRED');
  });

  it('does not advance a booking that is not PENDING_VERIFICATION', async () => {
    const deps = build();
    const confirmed = makeBooking({ status: 'CONFIRMED' });
    deps.bookings.findById.mockResolvedValue(confirmed);
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...confirmed,
      payment: makePayment(),
      member: makeMember(),
    } as any);

    await deps.service.getBookingDetail(BOOKING_ID, MEMBER_ID);

    expect(deps.bookings.transitionStatus).not.toHaveBeenCalled();
    expect(deps.bookings.advanceOutOfVerification).not.toHaveBeenCalled();
  });
});

describe('BookingService.applyPromo / removePromo', () => {
  it('applyPromo re-derives price and 409s PROMO_NOT_APPLICABLE from a bad status', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'CONFIRMED' }),
      payment: makePayment(),
      member: makeMember(),
    } as any);
    await expect(deps.service.applyPromo(BOOKING_ID, MEMBER_ID, 'SAVE10')).rejects.toMatchObject({
      code: 'PROMO_NOT_APPLICABLE',
    });
    expect(deps.courts.findById).not.toHaveBeenCalled();
  });

  it('applyPromo 409s PROMO_NOT_APPLICABLE for an invalid promo even in a changeable status', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_VERIFICATION' }),
      payment: null,
      member: makeMember(),
    } as any);
    deps.courts.findById.mockResolvedValue(makeCourt());
    deps.promotions.findByCode.mockResolvedValue(null);
    await expect(deps.service.applyPromo(BOOKING_ID, MEMBER_ID, 'BADCODE')).rejects.toMatchObject({
      code: 'PROMO_NOT_APPLICABLE',
    });
  });

  it('applyPromo applies the discount and persists the re-derived breakdown', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT' }),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      member: makeMember(),
    } as any);
    deps.courts.findById.mockResolvedValue(makeCourt());
    deps.promotions.findByCode.mockResolvedValue(makePromo({ discountType: 'PERCENTAGE', discountValue: 10 }));
    deps.bookings.updatePricing.mockImplementation(async (_id: string, data: any) => ({
      booking: makeBooking({ status: 'PENDING_PAYMENT', ...data }),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD', amountDue: data.totalAmount }),
    }));

    const detail = await deps.service.applyPromo(BOOKING_ID, MEMBER_ID, 'SAVE10');

    expect(deps.bookings.updatePricing).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.objectContaining({ appliedPromotionId: PROMO_ID, subtotalAmount: 10_000, totalAmount: 9_000 }),
    );
    expect(detail.price.total).toBe(9_000);
  });

  it('removePromo clears the promo and re-derives the base price', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT', appliedPromotionId: PROMO_ID, promotionDiscountAmount: 1_000 }),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD', amountDue: 9_000 }),
      member: makeMember(),
    } as any);
    deps.courts.findById.mockResolvedValue(makeCourt());
    deps.bookings.updatePricing.mockImplementation(async (_id: string, data: any) => ({
      booking: makeBooking({ status: 'PENDING_PAYMENT', ...data }),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD', amountDue: data.totalAmount }),
    }));

    const detail = await deps.service.removePromo(BOOKING_ID, MEMBER_ID);

    expect(deps.bookings.updatePricing).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.objectContaining({ appliedPromotionId: null, promotionDiscountAmount: null, totalAmount: 10_000 }),
    );
    expect(detail.price.total).toBe(10_000);
    expect(detail.price.promotion).toBeNull();
  });

  it('removePromo 409s PROMO_NOT_APPLICABLE outside a changeable status', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'CANCELLED' }),
      payment: null,
      member: makeMember(),
    } as any);
    await expect(deps.service.removePromo(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({
      code: 'PROMO_NOT_APPLICABLE',
    });
  });
});

describe('BookingService.requestCancellation', () => {
  it('CONFIRMED + before cutoff -> CANCELLATION_REQUESTED, slots not released, audit written', async () => {
    const deps = build();
    const startsAt = ict('2026-01-10', '08:00'); // Saturday, 5+ days away
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-05T00:00:00.000Z'));
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'CONFIRMED', startsAt }),
      payment: makePayment(),
      member: makeMember(),
    } as any);
    deps.config.get.mockResolvedValue(makeConfig({ cancellationCutoffHours: 2 }));
    deps.bookings.transitionStatus.mockResolvedValue(makeBooking({ status: 'CANCELLATION_REQUESTED', startsAt }));

    const detail = await deps.service.requestCancellation(BOOKING_ID, MEMBER_ID, 'change of plans');

    expect(deps.bookings.transitionStatus).toHaveBeenCalledWith(
      BOOKING_ID,
      'CANCELLATION_REQUESTED',
      expect.objectContaining({ cancellationRequestReason: 'change of plans' }),
    );
    // transitionStatus is a mocked black box here; verifying it's the ONLY
    // release-triggering call this method may issue (RELEASING_STATUSES does
    // not include CANCELLATION_REQUESTED — real release-on-write behaviour is
    // covered by the repository's own semantics, not re-tested here).
    expect(detail.status).toBe('CANCELLATION_REQUESTED');
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANCELLATION_REQUESTED', metadata: { reason: 'change of plans' } }),
    );
    jest.useRealTimers();
  });

  it('409s CANCELLATION_CUTOFF_PASSED once inside the cutoff window', async () => {
    const deps = build();
    const startsAt = ict('2026-01-05', '09:00');
    jest.useFakeTimers();
    jest.setSystemTime(ict('2026-01-05', '08:00')); // 1h before start, cutoff is 2h
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'CONFIRMED', startsAt }),
      payment: makePayment(),
      member: makeMember(),
    } as any);
    deps.config.get.mockResolvedValue(makeConfig({ cancellationCutoffHours: 2 }));

    await expect(deps.service.requestCancellation(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({
      code: 'CANCELLATION_CUTOFF_PASSED',
    });
    expect(deps.bookings.transitionStatus).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('409s on a non-CONFIRMED booking', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT' }),
      payment: makePayment(),
      member: makeMember(),
    } as any);
    await expect(deps.service.requestCancellation(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(deps.bookings.transitionStatus).not.toHaveBeenCalled();
  });

  it('404s when the booking belongs to a different member', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'CONFIRMED', memberId: 'someone-else' }),
      payment: makePayment(),
      member: makeMember({ id: 'someone-else' }),
    } as any);
    await expect(deps.service.requestCancellation(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('BookingService.adminModify', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  // Regression: modifySlots rewrites the Booking's price snapshot but never the
  // Payment row, so adminModify must ALWAYS re-sync Payment.amountDue — even for
  // a booking that never had a promo (the common case). A pure time move that
  // flips off-peak -> peak changes the total, which must reach the payment.
  it('re-syncs Payment.amountDue after a modify even with no prior promo', async () => {
    const deps = build();
    const court = makeCourt({
      gridIntervalMinutes: 60,
      maxSlots: 3,
      basePricePerGridUnit: 10_000,
      schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '12:00' }],
      peakTimeRanges: [
        { id: 'peak-1', label: 'Peak', days: ['MON'], startTime: '09:00', endTime: '12:00', pricePerGridUnit: 20_000 },
      ],
    });
    deps.courts.findById.mockResolvedValue(court);
    deps.branches.findById.mockResolvedValue(makeBranch());
    deps.sports.findById.mockResolvedValue(makeSport());
    deps.members.findById.mockResolvedValue(makeMember());
    deps.config.get.mockResolvedValue(makeConfig());
    deps.bookings.modifySlots.mockResolvedValue(undefined as any);
    deps.bookings.updatePricing.mockResolvedValue({} as any);
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT', startsAt: ict(DATE, '09:00'), totalAmount: 20_000 }),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD', amountDue: 20_000 }),
      member: makeMember(),
    } as any);

    // Original booking: off-peak 08:00 @ 10_000, NO promo. Move to peak 09:00.
    const original = makeBooking({ status: 'PENDING_PAYMENT', appliedPromotionId: null });
    await deps.service.adminModify(original, { start: ict(DATE, '09:00').toISOString() } as any, 'admin-1');

    expect(deps.bookings.updatePricing).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.objectContaining({ totalAmount: 20_000, appliedPromotionId: null, promotionDiscountAmount: null }),
    );
  });
});

describe('BookingService.listMyBookings', () => {
  it('scopes to upcoming (startsAt >= now) and returns the pagination envelope', async () => {
    const deps = build();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-05T00:00:00.000Z'));
    deps.bookings.listForMember.mockResolvedValue([
      {
        ...makeBooking(),
        payment: makePayment(),
        member: { phone: '0812345678', name: 'Somchai' },
      } as any,
    ]);
    deps.bookings.countForMember.mockResolvedValue(1);

    const res = await deps.service.listMyBookings(MEMBER_ID, { page: 1, pageSize: 20, scope: 'upcoming' } as any);

    expect(deps.bookings.listForMember).toHaveBeenCalledWith(
      MEMBER_ID,
      expect.objectContaining({ startsAtGte: new Date('2026-01-05T00:00:00.000Z'), startsAtLt: undefined, skip: 0, take: 20 }),
    );
    expect(res.items).toHaveLength(1);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(20);
    expect(res.total).toBe(1);
    expect(res.hasNextPage).toBe(false);
    jest.useRealTimers();
  });

  it('scopes to past (startsAt < now)', async () => {
    const deps = build();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-05T00:00:00.000Z'));
    deps.bookings.listForMember.mockResolvedValue([]);
    deps.bookings.countForMember.mockResolvedValue(0);

    await deps.service.listMyBookings(MEMBER_ID, { page: 1, pageSize: 20, scope: 'past' } as any);

    expect(deps.bookings.listForMember).toHaveBeenCalledWith(
      MEMBER_ID,
      expect.objectContaining({ startsAtGte: undefined, startsAtLt: new Date('2026-01-05T00:00:00.000Z') }),
    );
    jest.useRealTimers();
  });

  it('computes the correct skip/hasNextPage for page 2 of a larger result set', async () => {
    const deps = build();
    deps.bookings.listForMember.mockResolvedValue(
      Array.from({ length: 5 }, () => ({ ...makeBooking(), payment: makePayment(), member: { phone: null, name: null } } as any)),
    );
    deps.bookings.countForMember.mockResolvedValue(25);

    const res = await deps.service.listMyBookings(MEMBER_ID, { page: 2, pageSize: 5, scope: 'all' } as any);

    expect(deps.bookings.listForMember).toHaveBeenCalledWith(MEMBER_ID, expect.objectContaining({ skip: 5, take: 5 }));
    expect(res.hasNextPage).toBe(true);
  });
});
