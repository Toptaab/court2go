import type { Booking, Member, Payment } from '../../generated/prisma/client';
import { computeAllowedActions, mapToBookingDetail, mapToBookingListItem } from './booking.mapper';

/**
 * Unit coverage for the Prisma `Booking`(+`Payment`+`Member`) -> `BookingDetail`/
 * `BookingListItem` boundary mapper (ARCHITECTURE §3.1). The interesting part
 * is the PROVISIONAL `Payment` synthesis (no real Payment row exists yet,
 * pre-verification) and the member-actor `allowedActions` derivation.
 */
const BOOKING_ID = '00000000-0000-4000-8000-000000000001';
const MEMBER_ID = '00000000-0000-4000-8000-000000000002';

const baseBooking = (over: Partial<Booking> = {}): Booking =>
  ({
    id: BOOKING_ID,
    tenantId: 'tenant-1',
    memberId: MEMBER_ID,
    courtId: '00000000-0000-4000-8000-000000000010',
    branchId: '00000000-0000-4000-8000-000000000011',
    sportId: '00000000-0000-4000-8000-000000000012',
    branchName: 'Branch 1',
    sportName: 'Badminton',
    courtName: 'Court 1',
    branchPaymentMethod: 'PAY_ONSITE',
    status: 'PENDING_VERIFICATION',
    startsAt: new Date('2026-01-05T01:00:00.000Z'),
    endsAt: new Date('2026-01-05T02:00:00.000Z'),
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
    holdExpiresAt: null,
    cancellationRequestedAt: null,
    cancellationRequestReason: null,
    cancellationDecisionReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as Booking;

const basePayment = (over: Partial<Payment> = {}): Payment =>
  ({
    id: '00000000-0000-4000-8000-0000000000aa',
    tenantId: 'tenant-1',
    bookingId: BOOKING_ID,
    status: 'AWAITING_SLIP_UPLOAD',
    amountDue: 10_000,
    qrPayload: null,
    slipObjectKey: null,
    slipUploadedAt: null,
    reviewedByAdminId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:05:00.000Z'),
    updatedAt: new Date('2026-01-01T00:05:00.000Z'),
    ...over,
  }) as Payment;

const baseMember = (over: Partial<Member> = {}): Member =>
  ({
    id: MEMBER_ID,
    tenantId: 'tenant-1',
    phone: '0812345678',
    phoneVerified: true,
    name: 'Somchai',
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
  }) as Member;

describe('mapToBookingDetail — provisional vs real Payment', () => {
  it('synthesizes a provisional AWAITING_SLIP_UPLOAD payment (qr:null) for a QR branch with no Payment row', () => {
    const booking = baseBooking({ branchPaymentMethod: 'QR_CODE' });
    const detail = mapToBookingDetail(booking, null, baseMember(), { now: new Date(), cancellationCutoffHours: 2 });

    expect(detail.payment.status).toBe('AWAITING_SLIP_UPLOAD');
    expect(detail.payment.qr).toBeNull();
    expect(detail.payment.slipUrl).toBeNull();
    expect(detail.payment.id).toBe(BOOKING_ID); // documented placeholder id
    expect(detail.payment.amountDue).toBe(booking.totalAmount);
  });

  it('synthesizes a provisional PAY_ONSITE_NOT_COLLECTED payment for a Pay-Onsite branch with no Payment row', () => {
    const booking = baseBooking({ branchPaymentMethod: 'PAY_ONSITE' });
    const detail = mapToBookingDetail(booking, null, baseMember(), { now: new Date(), cancellationCutoffHours: 2 });

    expect(detail.payment.status).toBe('PAY_ONSITE_NOT_COLLECTED');
    expect(detail.payment.qr).toBeNull();
  });

  it('maps a real Payment row verbatim when present, ignoring the provisional derivation', () => {
    const booking = baseBooking({ branchPaymentMethod: 'QR_CODE' });
    const payment = basePayment({ status: 'SLIP_UPLOADED_PENDING_REVIEW', amountDue: 12_000 });
    const detail = mapToBookingDetail(booking, payment, baseMember(), { now: new Date(), cancellationCutoffHours: 2 });

    expect(detail.payment.status).toBe('SLIP_UPLOADED_PENDING_REVIEW');
    expect(detail.payment.id).toBe('00000000-0000-4000-8000-0000000000aa');
    expect(detail.payment.amountDue).toBe(12_000);
    expect(detail.payment.qr).toBeNull();
    expect(detail.payment.slipUrl).toBeNull();
  });
});

describe('computeAllowedActions', () => {
  const cutoffHours = 2;

  it('allows REQUEST_CANCELLATION only when CONFIRMED and before the cutoff', () => {
    const startsAt = new Date('2026-01-05T10:00:00.000Z');
    const now = new Date('2026-01-05T07:00:00.000Z'); // 3h before start
    const actions = computeAllowedActions({ status: 'CONFIRMED', startsAt, branchPaymentMethod: 'PAY_ONSITE' }, now, cutoffHours);
    expect(actions).toContain('REQUEST_CANCELLATION');
  });

  it('does not allow REQUEST_CANCELLATION once the cutoff has passed', () => {
    const startsAt = new Date('2026-01-05T10:00:00.000Z');
    const now = new Date('2026-01-05T09:00:00.000Z'); // 1h before start, cutoff 2h
    const actions = computeAllowedActions({ status: 'CONFIRMED', startsAt, branchPaymentMethod: 'PAY_ONSITE' }, now, cutoffHours);
    expect(actions).not.toContain('REQUEST_CANCELLATION');
  });

  it('does not allow REQUEST_CANCELLATION for a non-CONFIRMED booking', () => {
    const startsAt = new Date('2026-01-05T10:00:00.000Z');
    const now = new Date('2026-01-05T00:00:00.000Z');
    const actions = computeAllowedActions({ status: 'PENDING_PAYMENT', startsAt, branchPaymentMethod: 'PAY_ONSITE' }, now, cutoffHours);
    expect(actions).not.toContain('REQUEST_CANCELLATION');
  });

  it('allows UPLOAD_SLIP only when PENDING_PAYMENT on a QR_CODE branch', () => {
    const startsAt = new Date('2026-01-05T10:00:00.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');
    const actions = computeAllowedActions({ status: 'PENDING_PAYMENT', startsAt, branchPaymentMethod: 'QR_CODE' }, now, cutoffHours);
    expect(actions).toContain('UPLOAD_SLIP');
  });

  it('does not allow UPLOAD_SLIP on a Pay-Onsite branch even when PENDING_PAYMENT', () => {
    const startsAt = new Date('2026-01-05T10:00:00.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');
    const actions = computeAllowedActions({ status: 'PENDING_PAYMENT', startsAt, branchPaymentMethod: 'PAY_ONSITE' }, now, cutoffHours);
    expect(actions).not.toContain('UPLOAD_SLIP');
  });

  it('does not allow UPLOAD_SLIP once the booking is CONFIRMED (QR branch)', () => {
    const startsAt = new Date('2026-01-05T10:00:00.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');
    const actions = computeAllowedActions({ status: 'CONFIRMED', startsAt, branchPaymentMethod: 'QR_CODE' }, now, cutoffHours);
    expect(actions).not.toContain('UPLOAD_SLIP');
  });
});

describe('computeAllowedActions — ADMIN actor (M9)', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const startsAt = new Date('2026-01-05T10:00:00.000Z');
  const opts = (paymentStatus?: any) => ({ actor: 'ADMIN' as const, paymentStatus });

  it('offers confirm + reject on a slip pending review', () => {
    const actions = computeAllowedActions(
      { status: 'PENDING_PAYMENT_CONFIRMATION', startsAt, branchPaymentMethod: 'QR_CODE' },
      now,
      2,
      opts('SLIP_UPLOADED_PENDING_REVIEW'),
    );
    expect(actions).toEqual(expect.arrayContaining(['ADMIN_CONFIRM_PAYMENT', 'ADMIN_REJECT_PAYMENT', 'ADMIN_MODIFY', 'ADMIN_CANCEL']));
  });

  it('offers confirm (no reject) on a PENDING_PAYMENT booking', () => {
    const actions = computeAllowedActions(
      { status: 'PENDING_PAYMENT', startsAt, branchPaymentMethod: 'QR_CODE' },
      now,
      2,
      opts('AWAITING_SLIP_UPLOAD'),
    );
    expect(actions).toContain('ADMIN_CONFIRM_PAYMENT');
    expect(actions).not.toContain('ADMIN_REJECT_PAYMENT');
  });

  it('offers approve/decline on a cancellation request', () => {
    const actions = computeAllowedActions(
      { status: 'CANCELLATION_REQUESTED', startsAt, branchPaymentMethod: 'PAY_ONSITE' },
      now,
      2,
      opts(),
    );
    expect(actions).toEqual(expect.arrayContaining(['ADMIN_APPROVE_CANCELLATION', 'ADMIN_DECLINE_CANCELLATION']));
  });

  it('offers mark completed/no-show + cancel/modify on a CONFIRMED booking, never a payment confirm', () => {
    const actions = computeAllowedActions(
      { status: 'CONFIRMED', startsAt, branchPaymentMethod: 'PAY_ONSITE' },
      now,
      2,
      opts('PAY_ONSITE_NOT_COLLECTED'),
    );
    expect(actions).toEqual(expect.arrayContaining(['ADMIN_MARK_COMPLETED', 'ADMIN_MARK_NO_SHOW', 'ADMIN_MODIFY', 'ADMIN_CANCEL']));
    expect(actions).not.toContain('ADMIN_CONFIRM_PAYMENT');
  });

  it('offers no admin actions on a terminal (CANCELLED) booking', () => {
    const actions = computeAllowedActions(
      { status: 'CANCELLED', startsAt, branchPaymentMethod: 'QR_CODE' },
      now,
      2,
      opts(),
    );
    expect(actions).toEqual([]);
  });

  it('never emits member actions for the ADMIN actor', () => {
    const actions = computeAllowedActions(
      { status: 'CONFIRMED', startsAt, branchPaymentMethod: 'QR_CODE' },
      now,
      2,
      opts(),
    );
    expect(actions).not.toContain('REQUEST_CANCELLATION');
    expect(actions).not.toContain('UPLOAD_SLIP');
  });
});

describe('mapToBookingListItem', () => {
  it('derives the provisional paymentStatus/amountDue when no Payment row exists', () => {
    const row = {
      ...baseBooking({ branchPaymentMethod: 'QR_CODE' }),
      payment: null,
      member: { phone: '0812345678', name: 'Somchai' },
    };
    const item = mapToBookingListItem(row as any);
    expect(item.paymentStatus).toBe('AWAITING_SLIP_UPLOAD');
    expect(item.amountDue).toBe(row.totalAmount);
  });

  it('uses the real Payment amount/status when present', () => {
    const row = {
      ...baseBooking({ branchPaymentMethod: 'QR_CODE' }),
      payment: basePayment({ status: 'CONFIRMED', amountDue: 5_000 }),
      member: { phone: '0812345678', name: 'Somchai' },
    };
    const item = mapToBookingListItem(row as any);
    expect(item.paymentStatus).toBe('CONFIRMED');
    expect(item.amountDue).toBe(5_000);
  });
});
