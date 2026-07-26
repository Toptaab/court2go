import { runWithTenant } from '../../prisma/tenant-context';
import type { Booking, Branch, Member, Payment } from '../../generated/prisma/client';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PromotionCapReachedError } from '../bookings/errors';
import { PaymentsRepository } from './payments.repository';
import type { BranchesRepository } from '../branches/branches.repository';
import type { ConfigRepository } from '../config/config.repository';
import type { AuditLogRepository } from '../audit/audit-log.repository';
import type { ObjectStorage } from '../../integrations/ports/object-storage.port';
import type { PromptPayQrService } from '../../integrations/ports/promptpay-qr.port';
import { PaymentService } from './payment.service';

/**
 * Unit coverage for the Payment lifecycle orchestration (PRD C3.1,
 * ARCHITECTURE §4.3/§4.4/§6) — the explicit Payment status machine, the
 * client slip-upload flow, and the (not-yet-HTTP-wired) Admin confirm/reject
 * service methods. Repositories/integration ports are fully mocked (plain
 * jest mock objects); no DB. Mirrors `booking.service.spec.ts`'s style.
 */
const TENANT_ID = 'tenant-1';
const BOOKING_ID = '00000000-0000-4000-8000-000000000005';
const MEMBER_ID = '00000000-0000-4000-8000-000000000004';
const BRANCH_ID = '00000000-0000-4000-8000-000000000002';
const ADMIN_ID = '00000000-0000-4000-8000-0000000000ad';
const PROMO_ID = '00000000-0000-4000-8000-000000000006';

function makeMember(over: Partial<Member> = {}): Member {
  return {
    id: MEMBER_ID,
    tenantId: TENANT_ID,
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

function makeBooking(over: Partial<Booking> = {}): Booking {
  return {
    id: BOOKING_ID,
    tenantId: TENANT_ID,
    memberId: MEMBER_ID,
    courtId: '00000000-0000-4000-8000-000000000001',
    branchId: BRANCH_ID,
    sportId: '00000000-0000-4000-8000-000000000003',
    branchName: 'Branch 1',
    sportName: 'Badminton',
    courtName: 'Court 1',
    branchPaymentMethod: 'QR_CODE',
    status: 'PENDING_PAYMENT',
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
    tenantId: TENANT_ID,
    bookingId: BOOKING_ID,
    status: 'AWAITING_SLIP_UPLOAD',
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

function makeBranch(over: Partial<Branch> = {}): Branch {
  return {
    id: BRANCH_ID,
    tenantId: TENANT_ID,
    name: 'Branch 1',
    address: '123 Sukhumvit',
    paymentMethod: 'QR_CODE',
    promptPayId: '0899999999',
    businessHours: {} as any,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  } as Branch;
}

function build() {
  const bookings = {
    findByIdWithPayment: jest.fn(),
    submitSlip: jest.fn(),
    confirmPayment: jest.fn(),
    rejectPayment: jest.fn(),
  } as unknown as jest.Mocked<BookingsRepository>;

  const payments = {
    findByBookingId: jest.fn(),
  } as unknown as jest.Mocked<PaymentsRepository>;

  const branches = {
    findById: jest.fn().mockResolvedValue(makeBranch()),
  } as unknown as jest.Mocked<BranchesRepository>;

  const config = {
    get: jest.fn().mockResolvedValue({ cancellationCutoffHours: 2 }),
  } as unknown as jest.Mocked<ConfigRepository>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditLogRepository>;

  const objectStorage: jest.Mocked<ObjectStorage> = {
    createPresignedPutUrl: jest.fn().mockResolvedValue({
      uploadUrl: 'https://storage.local/put?sig=x',
      requiredHeaders: { 'Content-Type': 'image/png' },
      expiresAt: new Date('2026-01-01T00:10:00.000Z'),
    }),
    createSignedGetUrl: jest.fn().mockResolvedValue({
      url: 'https://storage.local/get?sig=x',
      expiresAt: new Date('2026-01-01T00:05:00.000Z'),
    }),
  };

  const promptPayQr: jest.Mocked<PromptPayQrService> = {
    generate: jest.fn().mockResolvedValue({ payload: 'PAYLOAD', qrImageDataUrl: 'data:image/png;base64,xx' }),
  };

  const service = new PaymentService(bookings, payments, branches, config, audit, objectStorage, promptPayQr);
  return { service, bookings, payments, branches, config, audit, objectStorage, promptPayQr };
}

describe('PaymentService.getPayment', () => {
  it('404s when the booking does not exist', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue(null);
    await expect(deps.service.getPayment(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('404s when the booking belongs to another member (fail-closed, no existence leak)', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking(),
      payment: makePayment(),
      member: makeMember(),
      memberId: 'someone-else',
    } as any);
    await expect(deps.service.getPayment(BOOKING_ID, MEMBER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('generates a QR for a QR_CODE branch while AWAITING_SLIP_UPLOAD', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking(),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      member: makeMember(),
    } as any);

    const dto = await deps.service.getPayment(BOOKING_ID, MEMBER_ID);

    expect(deps.promptPayQr.generate).toHaveBeenCalledWith({ promptPayId: '0899999999', amountThb: 10_000 });
    expect(dto.qr).toEqual({ payload: 'PAYLOAD', qrImageDataUrl: 'data:image/png;base64,xx' });
    expect(dto.slipUrl).toBeNull();
  });

  it('still generates a QR while SLIP_UPLOADED_PENDING_REVIEW, and includes slipUrl once a slip exists', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT_CONFIRMATION' }),
      payment: makePayment({ status: 'SLIP_UPLOADED_PENDING_REVIEW', slipObjectKey: 'tenants/t/slips/b/x' }),
      member: makeMember(),
    } as any);

    const dto = await deps.service.getPayment(BOOKING_ID, MEMBER_ID);

    expect(deps.promptPayQr.generate).toHaveBeenCalled();
    expect(deps.objectStorage.createSignedGetUrl).toHaveBeenCalledWith({
      objectKey: 'tenants/t/slips/b/x',
      expiresInSeconds: expect.any(Number),
    });
    expect(dto.slipUrl).toBe('https://storage.local/get?sig=x');
  });

  it('never generates a QR once CONFIRMED/REJECTED', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'CONFIRMED' }),
      payment: makePayment({ status: 'CONFIRMED' }),
      member: makeMember(),
    } as any);

    const dto = await deps.service.getPayment(BOOKING_ID, MEMBER_ID);

    expect(deps.promptPayQr.generate).not.toHaveBeenCalled();
    expect(dto.qr).toBeNull();
  });

  it('never generates a QR for a Pay-Onsite branch', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ branchPaymentMethod: 'PAY_ONSITE', status: 'CONFIRMED' }),
      payment: makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' }),
      member: makeMember(),
    } as any);

    const dto = await deps.service.getPayment(BOOKING_ID, MEMBER_ID);

    expect(deps.promptPayQr.generate).not.toHaveBeenCalled();
    expect(dto.status).toBe('PAY_ONSITE_NOT_COLLECTED');
  });

  it('synthesizes a provisional Payment DTO (still PENDING_VERIFICATION, no Payment row yet)', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_VERIFICATION' }),
      payment: null,
      member: makeMember(),
    } as any);

    const dto = await deps.service.getPayment(BOOKING_ID, MEMBER_ID);

    expect(dto.id).toBe(BOOKING_ID);
    expect(dto.status).toBe('AWAITING_SLIP_UPLOAD');
    expect(dto.amountDue).toBe(10_000);
    // Provisional QR-eligible status still generates a QR for a QR_CODE branch.
    expect(deps.promptPayQr.generate).toHaveBeenCalled();
  });
});

describe('PaymentService.getSlipUploadUrl', () => {
  it('404s for a booking the member does not own', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue(null);
    await expect(
      runWithTenant(TENANT_ID, () =>
        deps.service.getSlipUploadUrl(BOOKING_ID, MEMBER_ID, { contentType: 'image/png', contentLength: 100 }),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('409s for a Pay-Onsite branch booking', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ branchPaymentMethod: 'PAY_ONSITE', status: 'CONFIRMED' }),
      payment: makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' }),
      member: makeMember(),
    } as any);
    await expect(
      runWithTenant(TENANT_ID, () =>
        deps.service.getSlipUploadUrl(BOOKING_ID, MEMBER_ID, { contentType: 'image/png', contentLength: 100 }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('409s when the booking is not PENDING_PAYMENT', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT_CONFIRMATION' }),
      payment: makePayment({ status: 'SLIP_UPLOADED_PENDING_REVIEW' }),
      member: makeMember(),
    } as any);
    await expect(
      runWithTenant(TENANT_ID, () =>
        deps.service.getSlipUploadUrl(BOOKING_ID, MEMBER_ID, { contentType: 'image/png', contentLength: 100 }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('409 HOLD_EXPIREDs once the hold window has lapsed', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ holdExpiresAt: new Date(Date.now() - 1000) }),
      payment: makePayment(),
      member: makeMember(),
    } as any);
    await expect(
      runWithTenant(TENANT_ID, () =>
        deps.service.getSlipUploadUrl(BOOKING_ID, MEMBER_ID, { contentType: 'image/png', contentLength: 100 }),
      ),
    ).rejects.toMatchObject({ code: 'HOLD_EXPIRED' });
  });

  it('issues a presigned PUT URL under tenants/{tenantId}/slips/{bookingId}/{uuid} on the happy path', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking(),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      member: makeMember(),
    } as any);

    const result = await runWithTenant(TENANT_ID, () =>
      deps.service.getSlipUploadUrl(BOOKING_ID, MEMBER_ID, { contentType: 'image/png', contentLength: 12_345 }),
    );

    expect(result.objectKey).toMatch(
      new RegExp(`^tenants/${TENANT_ID}/slips/${BOOKING_ID}/[0-9a-f-]+$`),
    );
    expect(deps.objectStorage.createPresignedPutUrl).toHaveBeenCalledWith(
      expect.objectContaining({ objectKey: result.objectKey, contentType: 'image/png', contentLength: 12_345 }),
    );
    expect(result.uploadUrl).toBe('https://storage.local/put?sig=x');
  });

  it('rejects a content length over the server slip-size cap (no presigned URL issued)', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT' }),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      member: makeMember(),
    } as any);
    await expect(
      runWithTenant(TENANT_ID, () =>
        deps.service.getSlipUploadUrl(BOOKING_ID, MEMBER_ID, {
          contentType: 'image/png',
          contentLength: 50 * 1024 * 1024,
        }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(deps.objectStorage.createPresignedPutUrl).not.toHaveBeenCalled();
  });
});

describe('PaymentService.submitSlip', () => {
  it('409s when the payment is not AWAITING_SLIP_UPLOAD (already submitted)', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT_CONFIRMATION' }),
      payment: makePayment({ status: 'SLIP_UPLOADED_PENDING_REVIEW' }),
      member: makeMember(),
    } as any);
    await expect(
      deps.service.submitSlip(BOOKING_ID, MEMBER_ID, { objectKey: 'tenants/t/slips/b/x' }),
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('rejects an object key outside this booking + tenant slip prefix', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking(),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      member: makeMember(),
    } as any);
    await expect(
      runWithTenant(TENANT_ID, () =>
        // Points at another booking's slip directory — must be refused, not stored.
        deps.service.submitSlip(BOOKING_ID, MEMBER_ID, {
          objectKey: `tenants/${TENANT_ID}/slips/some-other-booking/x`,
        }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(deps.bookings.submitSlip).not.toHaveBeenCalled();
  });

  it('records the slip + audit trail and returns the updated BookingDetail on the happy path', async () => {
    const deps = build();
    const objectKey = `tenants/${TENANT_ID}/slips/${BOOKING_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`;
    const record = {
      ...makeBooking(),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      member: makeMember(),
    };
    deps.bookings.findByIdWithPayment.mockResolvedValue(record as any);
    deps.bookings.submitSlip.mockResolvedValue({
      booking: { ...record, status: 'PENDING_PAYMENT_CONFIRMATION' } as any,
      payment: { ...record.payment, status: 'SLIP_UPLOADED_PENDING_REVIEW', slipObjectKey: objectKey },
    });

    const detail = await runWithTenant(TENANT_ID, () =>
      deps.service.submitSlip(BOOKING_ID, MEMBER_ID, { objectKey }),
    );

    expect(deps.bookings.submitSlip).toHaveBeenCalledWith({ bookingId: BOOKING_ID, slipObjectKey: objectKey });
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYMENT_SLIP_SUBMITTED', entityId: BOOKING_ID }),
    );
    expect(detail.status).toBe('PENDING_PAYMENT_CONFIRMATION');
    expect(detail.payment.status).toBe('SLIP_UPLOADED_PENDING_REVIEW');
  });
});

describe('PaymentService.adminConfirmPayment', () => {
  it('404s when the booking does not exist', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue(null);
    await expect(deps.service.adminConfirmPayment(BOOKING_ID, ADMIN_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('409s a Pay-Onsite booking already CONFIRMED via auto-confirm', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ branchPaymentMethod: 'PAY_ONSITE', status: 'CONFIRMED' }),
      payment: makePayment({ status: 'PAY_ONSITE_NOT_COLLECTED' }),
      member: makeMember(),
    } as any);
    await expect(deps.service.adminConfirmPayment(BOOKING_ID, ADMIN_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(deps.bookings.confirmPayment).not.toHaveBeenCalled();
  });

  it('409s a terminal (REJECTED) booking', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'REJECTED' }),
      payment: makePayment({ status: 'REJECTED', rejectionReason: 'bad slip' }),
      member: makeMember(),
    } as any);
    await expect(deps.service.adminConfirmPayment(BOOKING_ID, ADMIN_ID)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });

  it('maps a PromotionCapReachedError to 409 PROMO_NOT_APPLICABLE', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT_CONFIRMATION', appliedPromotionId: PROMO_ID, promotionDiscountAmount: 1000 }),
      payment: makePayment({ status: 'SLIP_UPLOADED_PENDING_REVIEW' }),
      member: makeMember(),
    } as any);
    deps.bookings.confirmPayment.mockRejectedValue(new PromotionCapReachedError(PROMO_ID));

    await expect(deps.service.adminConfirmPayment(BOOKING_ID, ADMIN_ID)).rejects.toMatchObject({
      code: 'PROMO_NOT_APPLICABLE',
    });
  });

  it('confirms + audits on the happy path (slip review)', async () => {
    const deps = build();
    const record = {
      ...makeBooking({ status: 'PENDING_PAYMENT_CONFIRMATION' }),
      payment: makePayment({ status: 'SLIP_UPLOADED_PENDING_REVIEW' }),
      member: makeMember(),
    };
    deps.bookings.findByIdWithPayment.mockResolvedValue(record as any);
    deps.bookings.confirmPayment.mockResolvedValue({
      booking: { ...record, status: 'CONFIRMED' } as any,
      payment: { ...record.payment, status: 'CONFIRMED', reviewedByAdminId: ADMIN_ID, reviewedAt: new Date() },
    });

    const detail = await deps.service.adminConfirmPayment(BOOKING_ID, ADMIN_ID, 'looks good');

    expect(deps.bookings.confirmPayment).toHaveBeenCalledWith({ bookingId: BOOKING_ID, adminId: ADMIN_ID, note: 'looks good' });
    expect(deps.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_CONFIRMED' }));
    expect(detail.status).toBe('CONFIRMED');
    expect(detail.payment.status).toBe('CONFIRMED');
  });
});

describe('PaymentService.adminRejectPayment', () => {
  it('409s when the booking is not PENDING_PAYMENT_CONFIRMATION', async () => {
    const deps = build();
    deps.bookings.findByIdWithPayment.mockResolvedValue({
      ...makeBooking({ status: 'PENDING_PAYMENT' }),
      payment: makePayment({ status: 'AWAITING_SLIP_UPLOAD' }),
      member: makeMember(),
    } as any);
    await expect(deps.service.adminRejectPayment(BOOKING_ID, ADMIN_ID, 'blurry')).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(deps.bookings.rejectPayment).not.toHaveBeenCalled();
  });

  it('rejects + audits on the happy path', async () => {
    const deps = build();
    const record = {
      ...makeBooking({ status: 'PENDING_PAYMENT_CONFIRMATION' }),
      payment: makePayment({ status: 'SLIP_UPLOADED_PENDING_REVIEW' }),
      member: makeMember(),
    };
    deps.bookings.findByIdWithPayment.mockResolvedValue(record as any);
    deps.bookings.rejectPayment.mockResolvedValue({
      booking: { ...record, status: 'REJECTED' } as any,
      payment: { ...record.payment, status: 'REJECTED', rejectionReason: 'blurry' },
    });

    const detail = await deps.service.adminRejectPayment(BOOKING_ID, ADMIN_ID, 'blurry');

    expect(deps.bookings.rejectPayment).toHaveBeenCalledWith({ bookingId: BOOKING_ID, adminId: ADMIN_ID, reason: 'blurry' });
    expect(deps.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_REJECTED' }));
    expect(detail.status).toBe('REJECTED');
    expect(detail.payment.status).toBe('REJECTED');
    expect(detail.payment.rejectionReason).toBe('blurry');
  });
});

describe('PaymentService.issueSlipViewUrl', () => {
  it('404s when no slip has been uploaded', async () => {
    const deps = build();
    deps.payments.findByBookingId.mockResolvedValue(makePayment({ slipObjectKey: null }));
    await expect(deps.service.issueSlipViewUrl(BOOKING_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns a signed GET URL when a slip exists', async () => {
    const deps = build();
    deps.payments.findByBookingId.mockResolvedValue(makePayment({ slipObjectKey: 'tenants/t/slips/b/x' }));
    const result = await deps.service.issueSlipViewUrl(BOOKING_ID);
    expect(result.slipUrl).toBe('https://storage.local/get?sig=x');
    expect(deps.objectStorage.createSignedGetUrl).toHaveBeenCalledWith({
      objectKey: 'tenants/t/slips/b/x',
      expiresInSeconds: expect.any(Number),
    });
  });
});

