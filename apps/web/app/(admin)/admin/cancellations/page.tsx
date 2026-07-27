'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BookingListItem } from '@repo/types';
import { useAdminBookings } from '@/lib/hooks/use-admin-bookings';
import { useAdminCancellationDecision } from '@/lib/hooks/use-admin-booking-actions';
import { formatIctDate, formatIctTime, formatTHB } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/ui/badge';

/**
 * Cancellation-decision queue (Design D5, PRD A2.4). Reuses the existing
 * `GET /admin/bookings` list filtered to `status=CANCELLATION_REQUESTED` —
 * no separate queue endpoint. Each row owns its own decision mutation hook
 * (Rules of Hooks — the list's length changes as rows are decided).
 */
export default function AdminCancellationsQueuePage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminBookings({
    page,
    status: 'CANCELLATION_REQUESTED',
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">คำขอยกเลิก / Cancellation queue</h1>
        <p className="text-xs text-fg-muted">
          รายการที่ลูกค้าขอยกเลิก รออนุมัติ / Bookings members have asked to cancel.
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-surface-2" />
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
          ไม่มีคำขอยกเลิกที่รอดำเนินการ / No pending cancellation requests.
        </p>
      )}

      {data?.items.map((item) => <CancellationRow key={item.id} item={item} />)}

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

function CancellationRow({ item }: { item: BookingListItem }) {
  const [reason, setReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decision = useAdminCancellationDecision(item.id);

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
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/bookings/${item.id}`} className="text-sm font-semibold text-fg hover:underline">
                {item.courtName}
              </Link>
              <BookingStatusBadge status={item.status} />
            </div>
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
          <span className="font-score text-sm font-semibold text-accent">
            {formatTHB(item.amountDue)}
          </span>
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={decision.isPending}
            onClick={handleApprove}
          >
            {decision.isPending ? 'กำลังดำเนินการ...' : 'อนุมัติ / Approve'}
          </Button>
          {!showDeclineForm && (
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

        {showDeclineForm && (
          <div className="flex flex-col gap-2 rounded-card border border-status-danger/20 bg-status-danger/5 p-3">
            <label htmlFor={`decline-reason-${item.id}`} className="text-xs font-medium text-fg">
              เหตุผล (ไม่บังคับ) / Reason (optional)
            </label>
            <textarea
              id={`decline-reason-${item.id}`}
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
