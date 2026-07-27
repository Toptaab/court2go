'use client';

import { useMemo, useState } from 'react';
import { useAdminCalendar } from '@/lib/hooks/use-admin-bookings';
import { useBranches } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctTime } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';

/**
 * Returns today in ICT as YYYY-MM-DD.
 */
function todayICT(): string {
  const now = new Date();
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return ict.toISOString().slice(0, 10);
}

/**
 * Admin calendar (Design D1). Courts × time grid for a branch on a date.
 * Each booking shows as a colored block on the grid.
 */
export default function AdminCalendarPage() {
  const slug = getDevDefaultTenantSlug();
  const { data: branches } = useBranches(slug);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayICT());

  // Auto-select first branch
  const branchId = selectedBranchId || branches?.[0]?.id || '';

  const { data: calendarItems, isLoading } = useAdminCalendar(branchId, selectedDate);

  // Build time slots (30-min grid from 06:00 to 24:00)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 6; h < 24; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // Get unique courts from calendar items
  const courts = useMemo(() => {
    if (!calendarItems) return [];
    const seen = new Map<string, string>();
    for (const item of calendarItems) {
      if (!seen.has(item.courtId)) {
        seen.set(item.courtId, item.courtName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [calendarItems]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">ปฏิทิน / Calendar</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <select
          value={branchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg"
        >
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg"
        />
      </div>

      {/* Calendar grid */}
      {isLoading && (
        <div className="h-64 animate-pulse rounded-card bg-surface-2" />
      )}

      {calendarItems && courts.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">
          ไม่มีการจองในวันนี้ / No bookings today.
        </p>
      )}

      {calendarItems && courts.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <div className="min-w-[600px]">
              {/* Header: court names */}
              <div className="flex border-b border-line-100">
                <div className="w-16 shrink-0 border-r border-line-100 p-2 text-xs text-fg-muted">
                  เวลา
                </div>
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="flex-1 border-r border-line-100 p-2 text-center text-xs font-semibold text-fg"
                  >
                    {court.name}
                  </div>
                ))}
              </div>

              {/* Time rows */}
              {timeSlots.map((slot) => (
                <div key={slot} className="flex border-b border-line-100 last:border-b-0">
                  <div className="w-16 shrink-0 border-r border-line-100 p-1 font-score text-xs text-fg-muted">
                    {slot}
                  </div>
                  {courts.map((court) => {
                    // Find booking that covers this slot
                    const booking = calendarItems.find((item) => {
                      if (item.courtId !== court.id) return false;
                      const startTime = formatIctTime(item.startsAt);
                      return startTime === slot;
                    });

                    return (
                      <div
                        key={court.id}
                        className="relative flex-1 border-r border-line-100 p-0.5 last:border-r-0"
                        style={{ minHeight: '24px' }}
                      >
                        {booking && (
                          <Link href={`/admin/bookings/${booking.id}`}>
                            <div
                              className={cn(
                                'rounded px-1 py-0.5 text-[10px] leading-tight',
                                booking.status === 'CONFIRMED' && 'bg-status-ok/10 text-status-ok',
                                booking.status === 'PENDING_PAYMENT' && 'bg-status-warn/10 text-status-warn',
                                booking.status === 'PENDING_PAYMENT_CONFIRMATION' && 'bg-status-info/10 text-status-info',
                                (!['CONFIRMED', 'PENDING_PAYMENT', 'PENDING_PAYMENT_CONFIRMATION'].includes(booking.status)) && 'bg-surface-2 text-fg-muted',
                              )}
                            >
                              {booking.memberName ?? booking.memberPhone ?? '—'}
                            </div>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
