'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookingDetail, useCancellationRequest } from '@/lib/hooks/use-bookings';
import { formatTHB, formatIctDate, formatIctTime, formatIctDateTime } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/ui/badge';

/**
 * Booking detail page (Design M15/M16). Shows full booking info, payment
 * status, and actions (cancellation request if allowed).
 */
export default function BookingDetailPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { data: booking, isLoading, isError } = useBookingDetail(params.bookingId);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancellation = useCancellationRequest(params.bookingId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-48 animate-pulse rounded-card bg-surface-2" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">ไม่พบการจอง / Booking not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/bookings')}>
          ← กลับ / Back
        </Button>
      </div>
    );
  }

  const canCancel = booking.allowedActions.includes('REQUEST_CANCELLATION');
  const canUploadSlip = booking.allowedActions.includes('UPLOAD_SLIP');

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelError(null);
    try {
      await cancellation.mutateAsync({ reason: cancelReason.trim() || undefined });
      setShowCancelForm(false);
    } catch (err) {
      setCancelError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.push('/bookings')}
        className="self-start text-sm text-accent hover:underline"
      >
        ← การจองของฉัน / My bookings
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-disp text-lg font-semibold text-fg">
          รายละเอียดการจอง / Booking Detail
        </h1>
        <BookingStatusBadge status={booking.status} />
      </div>

      {/* Booking info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{booking.context.courtName}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">สาขา / Branch</span>
            <span className="text-fg">{booking.context.branchName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">กีฬา / Sport</span>
            <span className="text-fg">{booking.context.sportName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">วันที่ / Date</span>
            <span className="font-score text-fg">{formatIctDate(booking.startsAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">เวลา / Time</span>
            <span className="font-score text-fg">
              {formatIctTime(booking.startsAt)} – {formatIctTime(booking.endsAt)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">จำนวน / Slots</span>
            <span className="font-score text-fg">
              {booking.slotCount} ({booking.slotCount * booking.gridIntervalMinutes} นาที)
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">สร้างเมื่อ / Created</span>
            <span className="font-score text-xs text-fg">{formatIctDateTime(booking.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment info */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">การชำระเงิน / Payment</CardTitle>
            <PaymentStatusBadge status={booking.payment.status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {/* Price total */}
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">ยอดรวม / Total</span>
            <span className="font-score text-lg font-semibold text-accent">
              {formatTHB(booking.price.total)}
            </span>
          </div>

          {/* Promotion if applied */}
          {booking.price.promotion && (
            <div className="flex justify-between text-xs">
              <span className="text-status-ok">
                โปรโมชั่น: {booking.price.promotion.code}
              </span>
              <span className="font-score text-status-ok">
                −{formatTHB(booking.price.promotion.discountAmount)}
              </span>
            </div>
          )}

          {/* Upload slip action */}
          {canUploadSlip && (
            <Button
              variant="primary"
              size="sm"
              className="mt-2"
              onClick={() => router.push(`/bookings/${booking.id}/payment`)}
            >
              อัปโหลดสลิป / Upload slip
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Cancellation section */}
      {canCancel && !showCancelForm && (
        <Button
          variant="outline"
          className="w-full text-status-danger"
          onClick={() => setShowCancelForm(true)}
        >
          ขอยกเลิกการจอง / Request cancellation
        </Button>
      )}

      {showCancelForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCancel} className="flex flex-col gap-3">
              <p className="text-sm text-fg">
                กรุณาระบุเหตุผล (ไม่บังคับ) / Please state your reason (optional).
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="เหตุผลที่ต้องการยกเลิก..."
                maxLength={500}
                rows={3}
                className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {cancelError && (
                <p className="text-xs text-status-danger">{cancelError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowCancelForm(false)}
                >
                  ยกเลิก / Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={cancellation.isPending}
                >
                  {cancellation.isPending ? 'กำลังส่ง...' : 'ยืนยันขอยกเลิก / Confirm'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Status-specific messages */}
      {booking.status === 'CANCELLATION_REQUESTED' && (
        <div className="rounded-card border border-status-warn/20 bg-status-warn/5 px-3 py-2">
          <p className="text-sm text-status-warn">
            คำขอยกเลิกอยู่ระหว่างรอการอนุมัติ / Cancellation request is pending approval.
          </p>
        </div>
      )}

      {booking.status === 'EXPIRED' && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">
            การจองหมดเวลาแล้ว / This booking has expired.
          </p>
        </div>
      )}
    </div>
  );
}
