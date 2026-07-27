'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMyBookings } from '@/lib/hooks/use-bookings';
import { formatIctDate, formatIctTime, formatTHB } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Scope = 'upcoming' | 'past' | 'all';

/**
 * My Bookings tab content (Design M14) — embedded in the account acctabs.
 * Shows scope pills (upcoming/past/all), booking cards, pagination, and
 * empty state matching design M18 emptybox pattern.
 */
export function MyBookingsTab() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyBookings(scope, page);

  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Scope pills */}
      <div className="flex gap-1 rounded-card bg-surface-2 p-1">
        {(['upcoming', 'past', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleScopeChange(s)}
            className={cn(
              'flex-1 rounded-card px-3 py-2 text-xs font-medium transition-colors',
              scope === s
                ? 'bg-surface text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {s === 'upcoming' && 'Upcoming'}
            {s === 'past' && 'Past'}
            {s === 'all' && 'All'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {/* Empty state (Design M18 emptybox) */}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line-100 py-9 text-center">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-surface-2 text-[26px]">
            📅
          </div>
          <h3 className="text-base font-semibold text-fg">No bookings yet</h3>
          <p className="text-[13px] text-ink-500">
            When you book a court it'll show up here.
          </p>
          <Link href="/branches">
            <Button variant="primary" size="sm">
              Book a court
            </Button>
          </Link>
        </div>
      )}

      {/* Booking list */}
      {data?.items.map((item) => (
        <Link key={item.id} href={`/bookings/${item.id}`}>
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fg">
                  {item.courtName}
                </span>
                <BookingStatusBadge status={item.status} />
              </div>
              <div className="text-xs text-fg-muted">
                {item.branchName} · {item.sportName}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-score text-xs text-fg">
                  {formatIctDate(item.startsAt)} · {formatIctTime(item.startsAt)} – {formatIctTime(item.endsAt)}
                </span>
                <span className="font-score text-sm font-semibold text-accent">
                  {formatTHB(item.amountDue)}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}

      {/* Pagination */}
      {data && (data.hasNextPage || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span className="font-score text-xs text-fg-muted">
            {page} / {Math.ceil(data.total / data.pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
