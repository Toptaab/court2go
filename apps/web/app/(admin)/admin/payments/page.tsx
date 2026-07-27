'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BookingListItem } from '@repo/types';
import { useAdminBookings } from '@/lib/hooks/use-admin-bookings';
import {
  useAdminConfirmPayment,
  useAdminRejectPayment,
} from '@/lib/hooks/use-admin-booking-actions';
import { formatIctDate, formatIctTime, formatTHB } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaymentStatusBadge } from '@/components/ui/badge';
import { SlipViewer } from '@/components/admin/slip-viewer';

/**
 * Slip-review queue (Design D4, PRD A2.3). Reuses the existing
 * `GET /admin/bookings` list endpoint filtered to
 * `paymentStatus=SLIP_UPLOADED_PENDING_REVIEW` — there's no separate queue
 * endpoint. Each row is its own component (`SlipReviewRow`) so its
 * confirm/reject mutation hooks are called at a stable position regardless
 * of how many rows remain in the list across renders (Rules of Hooks).
 */
export default function AdminPaymentsQueuePage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminBookings({
    page,
    paymentStatus: 'SLIP_UPLOADED_PENDING_REVIEW',
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">ตรวจสอบสลิป / Slip review queue</h1>
        <p className="text-xs text-fg-muted">
          รายการที่รออัปโหลดสลิปให้ตรวจสอบ / Bookings awaiting slip confirmation.
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">
          เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load the queue.
        </p>
      )}

      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">
          ไม่มีรายการรอตรวจสอบ / Nothing waiting for review.
        </p>
      )}

      {data?.items.map((item) => <SlipReviewRow key={item.id} item={item} />)}

      {data && (data.hasNextPage || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า / Prev
          </Button>
          <span className="font-score text-xs text-fg-muted">
            {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
          </span>
          <Button variant="outline" size="sm" disabled={!data.hasNextPage} onClick={() => setPage((p) => p + 1)}>
            ถัดไป / Next
          </Button>
        </div>
      )}
    </div>
  );
}

function SlipReviewRow({ item }: { item: BookingListItem }) {
  const [reason, setReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmPayment = useAdminConfirmPayment(item.id);
  const rejectPayment = useAdminRejectPayment(item.id);

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
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/admin/bookings/${item.id}`} className="text-sm font-semibold text-fg hover:underline">
              {item.courtName}
            </Link>
            <p className="mt-0.5 text-xs text-fg-muted">
              {item.branchName} · {item.sportName}
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">
              {item.memberPhone ?? item.memberName ?? '—'}
            </p>
            <p className="mt-0.5 font-score text-xs text-fg-muted">
              {formatIctDate(item.startsAt)} · {formatIctTime(item.startsAt)}–{formatIctTime(item.endsAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <PaymentStatusBadge status={item.paymentStatus} />
            <span className="font-score text-sm font-semibold text-accent">
              {formatTHB(item.amountDue)}
            </span>
          </div>
        </div>

        <SlipViewer bookingId={item.id} />

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={confirmPayment.isPending}
            onClick={handleConfirm}
          >
            {confirmPayment.isPending ? 'กำลังยืนยัน...' : 'ยืนยัน / Confirm'}
          </Button>
          {!showRejectForm && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowRejectForm(true)}
            >
              ปฏิเสธ / Reject
            </Button>
          )}
        </div>

        {showRejectForm && (
          <div className="flex flex-col gap-2 rounded-card border border-status-danger/20 bg-status-danger/5 p-3">
            <label htmlFor={`reject-reason-${item.id}`} className="text-xs font-medium text-fg">
              เหตุผล (จำเป็น) / Reason (required)
            </label>
            <textarea
              id={`reject-reason-${item.id}`}
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
