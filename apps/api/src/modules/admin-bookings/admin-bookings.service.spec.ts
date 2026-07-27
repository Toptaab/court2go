import type { AdminUser, Booking, Member, Payment } from '../../generated/prisma/client';
import type { BookingsRepository } from '../bookings/bookings.repository';
import type { ConfigRepository } from '../config/config.repository';
import type { AuditLogRepository } from '../audit/audit-log.repository';
import type { BookingService } from '../bookings/booking.service';
import type { CourtsRepository } from '../courts/courts.repository';
import type { PaymentService } from '../payments/payment.service';
import { AdminBookingsService } from './admin-bookings.service';

const uid = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;
const BRANCH_A = uid('0a');
const BRANCH_OTHER = uid('0b');
const OWNER = { id: uid('01'), role: 'OWNER', branchId: null } as AdminUser;
const BRANCH_ADMIN_A = { id: uid('02'), role: 'BRANCH_ADMIN', branchId: BRANCH_A } as AdminUser;

function makeMember(over: Partial<Member> = {}): Member {
  return {
    id: uid('a1'), tenantId: 't1', phone: '0812345678', phoneVerified: true, name: 'X',
    emergencyContact: null, sex: null, lineUserId: null, lineBoundAt: null,
    isBlocked: false, blockedReason: null, blockedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'), ...over,
  } as Member;
}

function makeBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: uid('bc'), tenantId: 't1', memberId: uid('a1'), courtId: uid('c1'), branchId: BRANCH_A, sportId: uid('d1'),
    branchName: 'B', sportName: 'S', courtName: 'C', branchPaymentMethod: 'QR_CODE',
    status: 'CONFIRMED', startsAt: new Date('2026-02-05T01:00:00.000Z'), endsAt: new Date('2026-02-05T02:00:00.000Z'),
    gridIntervalMinutes: 60, slotCount: 1, verifiedVia: 'SELF_OTP', isWalkIn: false,
    priceBreakdown: { currency: 'THB', gridIntervalMinutes: 60, slotCount: 1, units: [{ index: 0, startTime: '08:00', isPeak: false, unitPrice: 10000 }], subtotal: 10000, promotion: null, total: 10000 },
    subtotalAmount: 10000, totalAmount: 10000, appliedPromotionId: null, promotionDiscountAmount: null,
    holdExpiresAt: null, cancellationRequestedAt: null, cancellationRequestReason: null, cancellationDecisionReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'), ...over,
  } as Booking;
}

function makePayment(over: Partial<Payment> = {}): Payment {
  return {
    id: uid('e1'), tenantId: 't1', bookingId: uid('bc'), status: 'CONFIRMED', amountDue: 10000,
    qrPayload: null, slipObjectKey: null, slipUploadedAt: null, reviewedByAdminId: null, reviewedAt: null,
    rejectionReason: null, createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'), ...over,
  } as Payment;
}

function build() {
  const bookings = {
    findByIdWithPayment: jest.fn(),
    listForAdmin: jest.fn().mockResolvedValue([]),
    countForAdmin: jest.fn().mockResolvedValue(0),
    listForCalendar: jest.fn().mockResolvedValue([]),
    transitionStatus: jest.fn().mockResolvedValue(makeBooking()),
  } as unknown as jest.Mocked<BookingsRepository>;
  const config = { get: jest.fn().mockResolvedValue({ cancellationCutoffHours: 2 }) } as unknown as jest.Mocked<ConfigRepository>;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditLogRepository>;
  const bookingService = { createWalkIn: jest.fn(), adminModify: jest.fn() } as unknown as jest.Mocked<BookingService>;
  const courts = { findById: jest.fn() } as unknown as jest.Mocked<CourtsRepository>;
  const payments = { adminConfirmPayment: jest.fn(), adminRejectPayment: jest.fn(), issueSlipViewUrl: jest.fn() } as unknown as jest.Mocked<PaymentService>;
  const service = new AdminBookingsService(bookings, config, audit, bookingService, courts, payments);
  return { service, bookings, config, audit, bookingService, courts, payments };
}

const recordFor = (over: Partial<Booking> = {}, payment: Payment | null = makePayment()) => ({
  ...makeBooking(over),
  payment,
  member: makeMember(),
});

describe('AdminBookingsService — branch scope', () => {
  it('403s a Branch Admin reading a booking in another branch', async () => {
    const { service, bookings } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ branchId: BRANCH_OTHER }));
    await expect(service.detail(BRANCH_ADMIN_A, uid('bc'))).rejects.toMatchObject({ code: 'BRANCH_SCOPE_DENIED' });
  });

  it('404s a missing booking', async () => {
    const { service, bookings } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(null);
    await expect(service.detail(OWNER, uid('bc'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets a Branch Admin read their own branch booking with ADMIN allowedActions', async () => {
    const { service, bookings } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ branchId: BRANCH_A }, makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' })));
    const detail = await service.detail(BRANCH_ADMIN_A, uid('bc'));
    expect(detail.allowedActions).toEqual(expect.arrayContaining(['ADMIN_MARK_COMPLETED', 'ADMIN_CANCEL']));
  });

  it('force-narrows a Branch Admin list to their own branch', async () => {
    const { service, bookings } = build();
    await service.list(BRANCH_ADMIN_A, { page: 1, pageSize: 20, branchId: BRANCH_OTHER } as any);
    const filters = (bookings.listForAdmin as jest.Mock).mock.calls[0][0];
    expect(filters.branchId).toBe(BRANCH_A);
  });
});

describe('AdminBookingsService — state guards', () => {
  it('rejects outcome on a non-CONFIRMED booking (409)', async () => {
    const { service, bookings } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ status: 'PENDING_PAYMENT' }));
    await expect(service.outcome(OWNER, uid('bc'), { outcome: 'COMPLETED' })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('marks a CONFIRMED booking COMPLETED', async () => {
    const { service, bookings } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ status: 'CONFIRMED' }));
    await service.outcome(OWNER, uid('bc'), { outcome: 'COMPLETED' });
    expect(bookings.transitionStatus).toHaveBeenCalledWith(uid('bc'), 'COMPLETED');
  });

  it('rejects a cancellation decision when none is pending (409)', async () => {
    const { service, bookings } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ status: 'CONFIRMED' }));
    await expect(service.cancellationDecision(OWNER, uid('bc'), { decision: 'APPROVE' })).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('APPROVE cancels + releases (CANCELLED), DECLINE restores to CONFIRMED', async () => {
    const { service, bookings } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ status: 'CANCELLATION_REQUESTED' }));
    await service.cancellationDecision(OWNER, uid('bc'), { decision: 'APPROVE' });
    expect(bookings.transitionStatus).toHaveBeenCalledWith(uid('bc'), 'CANCELLED', expect.anything());

    (bookings.transitionStatus as jest.Mock).mockClear();
    await service.cancellationDecision(OWNER, uid('bc'), { decision: 'DECLINE' });
    expect(bookings.transitionStatus).toHaveBeenCalledWith(uid('bc'), 'CONFIRMED', expect.anything());
  });
});

describe('AdminBookingsService — delegation', () => {
  it('branch-scopes before delegating a payment confirm', async () => {
    const { service, bookings, payments } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ branchId: BRANCH_OTHER, status: 'PENDING_PAYMENT_CONFIRMATION' }));
    await expect(service.confirmPayment(BRANCH_ADMIN_A, uid('bc'), 'note')).rejects.toMatchObject({ code: 'BRANCH_SCOPE_DENIED' });
    expect(payments.adminConfirmPayment).not.toHaveBeenCalled();
  });

  it('delegates a confirm once scope passes', async () => {
    const { service, bookings, payments } = build();
    (bookings.findByIdWithPayment as jest.Mock).mockResolvedValue(recordFor({ status: 'PENDING_PAYMENT_CONFIRMATION' }));
    (payments.adminConfirmPayment as jest.Mock).mockResolvedValue({ id: 'bk1' });
    await service.confirmPayment(OWNER, uid('bc'), 'ok');
    expect(payments.adminConfirmPayment).toHaveBeenCalledWith(uid('bc'), uid('01'), 'ok');
  });

  it('walk-in 404s an unknown court and 403s a cross-branch court', async () => {
    const { service, courts, bookingService } = build();
    (courts.findById as jest.Mock).mockResolvedValue(null);
    await expect(service.createWalkIn(OWNER, { courtId: uid('c1') } as any)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    (courts.findById as jest.Mock).mockResolvedValue({ id: uid('c1'), branchId: BRANCH_OTHER, isActive: true, deletedAt: null });
    await expect(service.createWalkIn(BRANCH_ADMIN_A, { courtId: uid('c1') } as any)).rejects.toMatchObject({ code: 'BRANCH_SCOPE_DENIED' });
    expect(bookingService.createWalkIn).not.toHaveBeenCalled();
  });
});
