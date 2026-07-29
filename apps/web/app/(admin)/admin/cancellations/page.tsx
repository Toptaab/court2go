'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BookingListItem } from '@repo/types';
import { useAdminBookings } from '@/lib/hooks/use-admin-bookings';
import { useAdminCancellationDecision } from '@/lib/hooks/use-admin-booking-actions';
import { formatIctDate, formatIctTime, formatTHB } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/ui/badge';
import { PaginatedTable, type DataTableColumn } from '@/components/ui/paginated-list';

/**
 * Cancellation-decision queue (Design D5, PRD A2.4). Reuses the existing
 * `GET /admin/bookings` list filtered to `status=CANCELLATION_REQUESTED` —
 * no separate queue endpoint. The Actions column owns its own decision
 * mutation hook per row (Rules of Hooks — the list's length changes as
 * rows are decided).
 */
export default function AdminCancellationsQueuePage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminBookings({
    page,
    status: 'CANCELLATION_REQUESTED',
  });

  const columns: DataTableColumn<BookingListItem>[] = [
    {
      header: 'Court',
      cell: (item) => (
        <>
          <div className="font-medium text-fg">{item.courtName}</div>
          <div className="text-xs text-fg-muted">{item.branchName} · {item.sportName}</div>
        </>
      ),
    },
    {
      header: 'Customer',
      cell: (item) => (
        <>
          <div className="font-medium text-fg">{item.memberName ?? '—'}</div>
          {item.memberPhone && <div className="font-mono text-xs text-fg-muted">{item.memberPhone}</div>}
        </>
      ),
    },
    {
      header: 'When',
      cell: (item) => (
        <span className="font-score text-xs text-fg">
          {formatIctDate(item.startsAt)} · {formatIctTime(item.startsAt)}–{formatIctTime(item.endsAt)}
        </span>
      ),
    },
    {
      header: 'Amount',
      cell: (item) => <span className="font-score text-sm font-semibold text-fg">{formatTHB(item.amountDue)}</span>,
    },
    { header: 'Status', cell: (item) => <BookingStatusBadge status={item.status} /> },
    { header: 'Actions', cell: (item) => <CancellationActions item={item} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">คำขอยกเลิก / Cancellation queue</h1>
        <p className="text-xs text-fg-muted">
          รายการที่ลูกค้าขอยกเลิก รออนุมัติ / Bookings members have asked to cancel.
        </p>
      </div>

      <PaginatedTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        columns={columns}
        keyOf={(item) => item.id}
        onRowClick={(item) => router.push(`/admin/bookings/${item.id}`)}
        emptyMessage="ไม่มีคำขอยกเลิกที่รอดำเนินการ / No pending cancellation requests."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load the queue."
        minWidth="min-w-[860px]"
      />
    </div>
  );
}

function CancellationActions({ item }: { item: BookingListItem }) {
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
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" disabled={decision.isPending} onClick={handleApprove}>
          {decision.isPending ? 'กำลังดำเนินการ...' : 'อนุมัติ / Approve'}
        </Button>
        {!showDeclineForm && (
          <Button type="button" variant="destructive" size="sm" onClick={() => setShowDeclineForm(true)}>
            ปฏิเสธ / Decline
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-status-danger">{error}</p>}

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
            <Button type="button" variant="destructive" size="sm" disabled={decision.isPending} onClick={handleDecline}>
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
    </div>
  );
}
