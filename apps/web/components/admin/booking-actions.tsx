'use client';

import { useState } from 'react';
import type { BookingDetail } from '@repo/types';
import {
  useAdminConfirmPayment,
  useAdminRejectPayment,
  useAdminCancelBooking,
  useAdminSetOutcome,
  useAdminCancellationDecision,
} from '@/lib/hooks/use-admin-booking-actions';
import { messageForError } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SlipViewer } from '@/components/admin/slip-viewer';

/**
 * Booking detail action controls (D2 detail, PRD A2.1–A2.4). Every section is
 * gated on `booking.allowedActions` — the server-computed, RBAC/policy-aware
 * list on `BookingDetail` (`packages/types` `entities/booking.ts`) — never on
 * a client-side guess at status/paymentStatus. A 403 `BRANCH_SCOPE_DENIED` or
 * 409 (`INVALID_STATE_TRANSITION`, etc.) is still possible even when a
 * control is shown (state can move between the fetch and the click); those
 * surface inline via `messageForError`, never crash the page.
 */
export function BookingActions({ booking }: { booking: BookingDetail }) {
  const actions = booking.allowedActions;

  const canConfirmPayment = actions.includes('ADMIN_CONFIRM_PAYMENT');
  const canRejectPayment = actions.includes('ADMIN_REJECT_PAYMENT');
  const canCancel = actions.includes('ADMIN_CANCEL');
  const canMarkCompleted = actions.includes('ADMIN_MARK_COMPLETED');
  const canMarkNoShow = actions.includes('ADMIN_MARK_NO_SHOW');
  const canApproveCancellation = actions.includes('ADMIN_APPROVE_CANCELLATION');
  const canDeclineCancellation = actions.includes('ADMIN_DECLINE_CANCELLATION');

  const hasNothingToShow =
    !canConfirmPayment &&
    !canRejectPayment &&
    !canCancel &&
    !canMarkCompleted &&
    !canMarkNoShow &&
    !canApproveCancellation &&
    !canDeclineCancellation;

  if (hasNothingToShow) {
    return (
      <div className="rounded-card border border-line-100 bg-surface-2 p-4 text-center text-xs text-fg-muted">
        ไม่มีการดำเนินการที่ทำได้ในสถานะนี้ / No actions available for this booking&apos;s current status.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {(canConfirmPayment || canRejectPayment) && (
        <PaymentReviewSection
          bookingId={booking.id}
          canConfirm={canConfirmPayment}
          canReject={canRejectPayment}
        />
      )}

      {(canApproveCancellation || canDeclineCancellation) && (
        <CancellationDecisionSection
          bookingId={booking.id}
          canApprove={canApproveCancellation}
          canDecline={canDeclineCancellation}
        />
      )}

      {(canMarkCompleted || canMarkNoShow) && (
        <OutcomeSection
          bookingId={booking.id}
          canComplete={canMarkCompleted}
          canNoShow={canMarkNoShow}
        />
      )}

      {canCancel && <CancelSection bookingId={booking.id} />}
    </div>
  );
}

/* ------------------------------------------------------------------ Payment review (D4) */

function PaymentReviewSection({
  bookingId,
  canConfirm,
  canReject,
}: {
  bookingId: string;
  canConfirm: boolean;
  canReject: boolean;
}) {
  const [reason, setReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmPayment = useAdminConfirmPayment(bookingId);
  const rejectPayment = useAdminRejectPayment(bookingId);

  const handleConfirm = async () => {
    setError(null);
    try {
      await confirmPayment.mutateAsync({});
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleReject = async () => {
    setError(null);
    if (reason.trim().length < 1) {
      setError('กรุณาระบุเหตุผลในการปฏิเสธ / A rejection reason is required.');
      return;
    }
    try {
      await rejectPayment.mutateAsync({ reason: reason.trim() });
      setShowRejectForm(false);
      setReason('');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">ตรวจสอบสลิป / Payment review</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SlipViewer bookingId={bookingId} />

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {canConfirm && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={confirmPayment.isPending}
              onClick={handleConfirm}
            >
              {confirmPayment.isPending ? 'กำลังยืนยัน...' : 'ยืนยันการชำระเงิน / Confirm payment'}
            </Button>
          )}
          {canReject && !showRejectForm && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowRejectForm(true)}
            >
              ปฏิเสธสลิป / Reject slip
            </Button>
          )}
        </div>

        {canReject && showRejectForm && (
          <div className="flex flex-col gap-2 rounded-card border border-status-danger/20 bg-status-danger/5 p-3">
            <label htmlFor="reject-reason" className="text-xs font-medium text-fg">
              เหตุผล (จำเป็น) / Reason (required)
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="เช่น ยอดเงินไม่ตรง / e.g. amount does not match"
              className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={rejectPayment.isPending}
                onClick={handleReject}
              >
                {rejectPayment.isPending ? 'กำลังปฏิเสธ...' : 'ยืนยันการปฏิเสธ / Confirm reject'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRejectForm(false);
                  setReason('');
                  setError(null);
                }}
              >
                ยกเลิก / Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ Cancellation decision (D5) */

function CancellationDecisionSection({
  bookingId,
  canApprove,
  canDecline,
}: {
  bookingId: string;
  canApprove: boolean;
  canDecline: boolean;
}) {
  const [reason, setReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decision = useAdminCancellationDecision(bookingId);

  const handleApprove = async () => {
    setError(null);
    try {
      await decision.mutateAsync({ decision: 'APPROVE' });
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleDecline = async () => {
    setError(null);
    try {
      await decision.mutateAsync({ decision: 'DECLINE', reason: reason.trim() || undefined });
      setShowDeclineForm(false);
      setReason('');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">คำขอยกเลิก / Cancellation request</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {canApprove && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={decision.isPending}
              onClick={handleApprove}
            >
              {decision.isPending ? 'กำลังดำเนินการ...' : 'อนุมัติ / Approve'}
            </Button>
          )}
          {canDecline && !showDeclineForm && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeclineForm(true)}
            >
              ปฏิเสธ / Decline
            </Button>
          )}
        </div>

        {canDecline && showDeclineForm && (
          <div className="flex flex-col gap-2 rounded-card border border-status-danger/20 bg-status-danger/5 p-3">
            <label htmlFor="decline-reason" className="text-xs font-medium text-fg">
              เหตุผล (ไม่บังคับ) / Reason (optional)
            </label>
            <textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={decision.isPending}
                onClick={handleDecline}
              >
                {decision.isPending ? 'กำลังปฏิเสธ...' : 'ยืนยันการปฏิเสธ / Confirm decline'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDeclineForm(false);
                  setReason('');
                  setError(null);
                }}
              >
                ยกเลิก / Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ Outcome (COMPLETED / NO_SHOW) */

function OutcomeSection({
  bookingId,
  canComplete,
  canNoShow,
}: {
  bookingId: string;
  canComplete: boolean;
  canNoShow: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const setOutcome = useAdminSetOutcome(bookingId);

  const handleSetOutcome = async (outcome: 'COMPLETED' | 'NO_SHOW') => {
    setError(null);
    try {
      await setOutcome.mutateAsync({ outcome });
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">ผลการใช้บริการ / Outcome</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <p className="text-xs text-status-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {canComplete && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={setOutcome.isPending}
              onClick={() => handleSetOutcome('COMPLETED')}
            >
              เสร็จสิ้น / Mark completed
            </Button>
          )}
          {canNoShow && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={setOutcome.isPending}
              onClick={() => handleSetOutcome('NO_SHOW')}
            >
              ไม่มาใช้บริการ / Mark no-show
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ Admin cancel */

function CancelSection({ bookingId }: { bookingId: string }) {
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelBooking = useAdminCancelBooking(bookingId);

  const handleCancel = async () => {
    setError(null);
    try {
      await cancelBooking.mutateAsync({ reason: reason.trim() || undefined });
      setShowForm(false);
      setReason('');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">ยกเลิกการจอง / Cancel booking</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <p className="text-xs text-status-danger">{error}</p>}

        {!showForm && (
          <Button type="button" variant="destructive" size="sm" onClick={() => setShowForm(true)}>
            ยกเลิกการจอง / Cancel booking
          </Button>
        )}

        {showForm && (
          <div className="flex flex-col gap-2 rounded-card border border-status-danger/20 bg-status-danger/5 p-3">
            <label htmlFor="cancel-reason" className="text-xs font-medium text-fg">
              เหตุผล (ไม่บังคับ) / Reason (optional)
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={cancelBooking.isPending}
                onClick={handleCancel}
              >
                {cancelBooking.isPending ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก / Confirm cancel'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setReason('');
                  setError(null);
                }}
              >
                กลับ / Back
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
