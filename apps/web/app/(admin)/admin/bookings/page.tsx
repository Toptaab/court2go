'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminBookings } from '@/lib/hooks/use-admin-bookings';
import { useBranches } from '@/lib/hooks/use-public-catalog';
import { useAdminSports } from '@/lib/hooks/use-admin-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctDate, formatIctTime, formatTHB } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/ui/badge';
import { PageHeader } from '@/components/admin/page-header';
import { WalkInModal } from '@/components/admin/walk-in-modal';
import { cn } from '@/lib/utils';

/**
 * Admin booking list (Design D2). Filterable, paginated table of all
 * bookings — quick chips for the two "needs my attention" queues, then
 * branch/sport/date/status filters + a phone search, mirroring the
 * mockup's `.filters` row.
 */
export default function AdminBookingsPage() {
  const slug = getDevDefaultTenantSlug();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [activeQuick, setActiveQuick] = useState<'awaiting-review' | 'cancellation-requested' | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | undefined>();
  const [sportId, setSportId] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [phoneFilter, setPhoneFilter] = useState('');
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data: branches } = useBranches(slug);
  const { data: sports } = useAdminSports();

  const toggleQuick = (key: 'awaiting-review' | 'cancellation-requested') => {
    setActiveQuick((prev) => (prev === key ? null : key));
    setPage(1);
  };

  const { data, isLoading } = useAdminBookings({
    page,
    status: activeQuick === 'cancellation-requested' ? 'CANCELLATION_REQUESTED' : statusFilter,
    paymentStatus: activeQuick === 'awaiting-review' ? 'SLIP_UPLOADED_PENDING_REVIEW' : undefined,
    branchId,
    sportId,
    dateFrom,
    dateTo,
    phone: phoneFilter || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="การจองทั้งหมด / All Bookings"
        subtitle={
          data
            ? `ทุกสาขา · ${data.total} ผลลัพธ์ / All branches · ${data.total} results`
            : 'ทุกสาขา / All branches'
        }
        actions={
          <>
            <Button type="button" variant="outline" size="sm">
              ส่งออก / Export
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => setWalkInOpen(true)}>
              + จองหน้างาน / Walk-in booking
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggleQuick('awaiting-review')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-card border px-3 py-1.5 text-xs font-semibold transition-colors',
            activeQuick === 'awaiting-review'
              ? 'border-accent bg-accent-tint text-accent'
              : 'border-line-300 bg-surface text-fg-muted hover:bg-surface-2',
          )}
        >
          รอตรวจสอบ / Awaiting my review
        </button>
        <button
          type="button"
          onClick={() => toggleQuick('cancellation-requested')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-card border px-3 py-1.5 text-xs font-semibold transition-colors',
            activeQuick === 'cancellation-requested'
              ? 'border-status-danger bg-status-danger/10 text-status-danger'
              : 'border-line-300 bg-surface text-fg-muted hover:bg-surface-2',
          )}
        >
          ขอยกเลิก / Cancellation requested
        </button>

        <select
          value={branchId ?? ''}
          onChange={(e) => { setBranchId(e.target.value || undefined); setPage(1); }}
          className="rounded-card border border-line-300 bg-surface px-3 py-1.5 text-xs text-fg"
        >
          <option value="">สาขา: ทั้งหมด / Branch: All</option>
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={sportId ?? ''}
          onChange={(e) => { setSportId(e.target.value || undefined); setPage(1); }}
          className="rounded-card border border-line-300 bg-surface px-3 py-1.5 text-xs text-fg"
        >
          <option value="">กีฬา: ทั้งหมด / Sport: All</option>
          {sports?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="date"
            aria-label="วันที่เริ่ม / Date from"
            value={dateFrom ?? ''}
            onChange={(e) => { setDateFrom(e.target.value || undefined); setPage(1); }}
            className="rounded-card border border-line-300 bg-surface px-2 py-1.5 text-xs text-fg"
          />
          <span className="text-xs text-fg-muted">–</span>
          <input
            type="date"
            aria-label="ถึงวันที่ / Date to"
            value={dateTo ?? ''}
            onChange={(e) => { setDateTo(e.target.value || undefined); setPage(1); }}
            className="rounded-card border border-line-300 bg-surface px-2 py-1.5 text-xs text-fg"
          />
        </div>

        <select
          value={statusFilter ?? ''}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setActiveQuick(null); setPage(1); }}
          className="rounded-card border border-line-300 bg-surface px-3 py-1.5 text-xs text-fg"
        >
          <option value="">สถานะ: ทั้งหมด / Status: Any</option>
          <option value="PENDING_VERIFICATION">Pending Verification</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="PENDING_PAYMENT_CONFIRMATION">Pending Confirmation</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLATION_REQUESTED">Cancellation Requested</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
          <option value="NO_SHOW">No Show</option>
        </select>

        <div className="ml-auto flex min-w-[210px] items-center gap-2 rounded-card border border-line-300 bg-surface px-3 py-1.5">
          <svg aria-hidden className="h-4 w-4 shrink-0 text-fg-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="ค้นหาเบอร์โทร / Search phone / name / #ID"
            value={phoneFilter}
            onChange={(e) => { setPhoneFilter(e.target.value); setPage(1); }}
            className="w-full bg-transparent text-xs text-fg placeholder:text-fg-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {/* Empty */}
      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">
          ไม่พบการจอง / No bookings found.
        </p>
      )}

      {/* Table */}
      {data && data.items.length > 0 && (
        <div className="overflow-hidden overflow-x-auto rounded-card border border-line-100">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-100">
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Booking</th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Customer</th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Court</th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">When</th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Amount</th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Booking status</th>
                <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-100">
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => router.push(`/admin/bookings/${item.id}`)}
                  className="cursor-pointer transition-colors hover:bg-surface-2"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/bookings/${item.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-xs font-semibold text-accent hover:underline"
                    >
                      #{item.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-fg">{item.memberName ?? '—'}</div>
                    {item.memberPhone && (
                      <div className="font-mono text-xs text-fg-muted">{item.memberPhone}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-fg">
                    {item.courtName} · {item.sportName}
                  </td>
                  <td className="px-3 py-2.5 font-score text-xs text-fg">
                    {formatIctDate(item.startsAt)} · {formatIctTime(item.startsAt)}–{formatIctTime(item.endsAt)}
                  </td>
                  <td className="px-3 py-2.5 font-score text-sm font-semibold text-fg">
                    {formatTHB(item.amountDue)}
                  </td>
                  <td className="px-3 py-2.5">
                    <BookingStatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <PaymentStatusBadge status={item.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
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

      <p className="text-xs text-fg-muted">
        Branch Admins เห็นเฉพาะสาขาของตน (ไม่มีตัวกรองสาขา) ส่วน Owner/Admin เห็นทุกสาขา / Branch Admins see this
        list locked to their branch (no branch filter). Owner/Admin see all branches.
      </p>

      <WalkInModal open={walkInOpen} onClose={() => setWalkInOpen(false)} />
    </div>
  );
}
