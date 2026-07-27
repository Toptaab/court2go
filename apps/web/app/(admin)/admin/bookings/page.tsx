'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminBookings } from '@/lib/hooks/use-admin-bookings';
import { formatIctDate, formatIctTime, formatTHB } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/ui/badge';

/**
 * Admin booking list (Design D2). Filterable, paginated list of all bookings.
 */
export default function AdminBookingsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [phoneFilter, setPhoneFilter] = useState('');

  const { data, isLoading } = useAdminBookings({
    page,
    status: statusFilter,
    phone: phoneFilter || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">การจองทั้งหมด / All Bookings</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter ?? ''}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
          className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg"
        >
          <option value="">สถานะทั้งหมด / All statuses</option>
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
        <input
          type="text"
          placeholder="ค้นหาเบอร์โทร / Search phone"
          value={phoneFilter}
          onChange={(e) => { setPhoneFilter(e.target.value); setPage(1); }}
          className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {/* Empty */}
      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">
          ไม่พบการจอง / No bookings found.
        </p>
      )}

      {/* Table-like list */}
      {data?.items.map((item) => (
        <Link key={item.id} href={`/admin/bookings/${item.id}`}>
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{item.courtName}</span>
                  <BookingStatusBadge status={item.status} />
                </div>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {item.branchName} · {item.sportName}
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {item.memberPhone ?? item.memberName ?? '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-score text-xs text-fg">
                  {formatIctDate(item.startsAt)}
                </p>
                <p className="font-score text-xs text-fg-muted">
                  {formatIctTime(item.startsAt)} – {formatIctTime(item.endsAt)}
                </p>
                <p className="mt-1 font-score text-sm font-semibold text-accent">
                  {formatTHB(item.amountDue)}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}

      {/* Pagination */}
      {data && (data.hasNextPage || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า / Prev
          </Button>
          <span className="font-score text-xs text-fg-muted">
            {page} / {Math.ceil(data.total / data.pageSize)}
          </span>
          <Button variant="outline" size="sm" disabled={!data.hasNextPage} onClick={() => setPage((p) => p + 1)}>
            ถัดไป / Next
          </Button>
        </div>
      )}
    </div>
  );
}
