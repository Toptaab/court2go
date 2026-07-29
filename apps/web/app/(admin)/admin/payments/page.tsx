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
import { Button, buttonVariants } from '@/components/ui/button';
import { PaymentStatusBadge } from '@/components/ui/badge';
import { PaginatedList } from '@/components/ui/paginated-list';
import { SlipViewer } from '@/components/admin/slip-viewer';
import { PageHeader } from '@/components/admin/page-header';

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
      <PageHeader
        title="ตรวจสอบสลิป / Slip review"
        subtitle={
          data
            ? `${data.total} รายการรอตรวจสอบ / ${data.total} awaiting review`
            : 'รายการที่รออัปโหลดสลิปให้ตรวจสอบ / Bookings awaiting slip confirmation.'
        }
      />

      <PaginatedList
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        keyOf={(item) => item.id}
        emptyMessage="ไม่มีรายการรอตรวจสอบ / Nothing waiting for review."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load the queue."
        skeletonCount={2}
        skeletonClassName="h-64"
        renderItem={(item) => <SlipReviewRow item={item} />}
      />
    </div>
  );
}

/**
 * One pending booking as a two-panel split (Design D4): left panel = the
 * uploaded transfer slip, right panel = booking key-value detail + actions.
 * The mockup's slip panel shows fabricated fields (bank name, masked
 * PromptPay number, ref number, an OCR'd-amount match callout) that don't
 * exist in this app's data model — the real slip is only an image behind a
 * short-lived signed URL (`SlipViewer`); everything shown here is a real
 * `item` field, nothing invented.
 */
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

  // Not a fabricated booking "code" — a short, real substring of the
  // booking's own UUID, only for a human-scannable reference in the header.
  const shortRef = item.id.slice(0, 8).toUpperCase();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left panel — the transfer slip */}
      <div className="flex flex-col rounded-card border border-line-100 bg-surface">
        <div className="flex items-center gap-2 border-b border-line-100 px-4 py-3">
          <span className="text-sm font-semibold text-fg">
            สลิปโอนเงิน / Transfer slip <span className="font-score text-fg-muted">· #{shortRef}</span>
          </span>
          <PaymentStatusBadge status={item.paymentStatus} className="ml-auto" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="rounded-card border border-line-100 bg-surface-2 p-2">
            <SlipViewer bookingId={item.id} />
          </div>
          <p className="text-xs text-fg-muted">
            การยืนยันจะบันทึกชื่อผู้ดูแลและเวลา / Confirming records your name + timestamp for
            audit. ช่องเวลายังคงถูกจองไว้ระหว่างนี้ / The slot is held meanwhile.
          </p>
        </div>
      </div>

      {/* Right panel — booking detail + actions */}
      <div className="flex flex-col rounded-card border border-line-100 bg-surface">
        <div className="border-b border-line-100 px-4 py-3">
          <span className="text-sm font-semibold text-fg">การจอง / Booking</span>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <KvRow label="ลูกค้า / Customer" value={item.memberName ?? '—'} />
          <KvRow label="เบอร์โทร / Phone" value={item.memberPhone ?? '—'} mono />
          <KvRow label="สนาม / Court" value={`${item.courtName} · ${item.sportName}`} />
          <KvRow
            label="เวลา / When"
            value={`${formatIctDate(item.startsAt)} · ${formatIctTime(item.startsAt)}–${formatIctTime(item.endsAt)}`}
            mono
          />
          <KvRow label="ยอดที่ต้องชำระ / Amount due" value={formatTHB(item.amountDue)} mono last />

          {error && <p className="mt-2 text-xs text-status-danger">{error}</p>}

          <div className="mt-4 flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              className="justify-center bg-status-ok hover:opacity-90"
              disabled={confirmPayment.isPending}
              onClick={handleConfirm}
            >
              {confirmPayment.isPending ? 'กำลังยืนยัน...' : 'ยืนยันการชำระเงิน / Confirm payment'}
            </Button>
            {!showRejectForm && (
              <Button
                type="button"
                variant="destructive"
                className="justify-center"
                onClick={() => setShowRejectForm(true)}
              >
                ปฏิเสธ (ต้องระบุเหตุผล) / Reject (needs reason)
              </Button>
            )}
            <Link
              href={`/admin/bookings/${item.id}`}
              className={buttonVariants({ variant: 'secondary', className: 'justify-center' })}
            >
              ดูรายละเอียดทั้งหมด / Open full booking
            </Link>
          </div>

          {showRejectForm && (
            <div className="mt-3 flex flex-col gap-2 rounded-card border border-status-danger/20 bg-status-danger/5 p-3">
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
        </div>
      </div>
    </div>
  );
}

function KvRow({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1.5 text-sm ${
        last ? '' : 'border-b border-dashed border-line-100'
      }`}
    >
      <span className="text-fg-muted">{label}</span>
      <span className={`text-right font-medium text-fg ${mono ? 'font-score' : ''}`}>{value}</span>
    </div>
  );
}
