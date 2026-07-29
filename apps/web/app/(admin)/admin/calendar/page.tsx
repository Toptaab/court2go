'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useAdminCalendar } from '@/lib/hooks/use-admin-bookings';
import { useBranches } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctTime } from '@/lib/format';
import { formatBilingual, type Bilingual } from '@/lib/copy';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/page-header';
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

/** `YYYY-MM-DD` + a day delta → `YYYY-MM-DD`, for the prev/next day nav arrows. */
function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

const dateNavFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `YYYY-MM-DD` → `"Fri, 25 Jul 2026"` for the date-nav label (mockup D1's `◂ Fri 25 Jul 2026 ▸`). */
function formatDateNavLabel(date: string): string {
  return dateNavFormatter.format(new Date(`${date}T00:00:00Z`));
}

// --- Grid lattice constants (fixed 30-min lock lattice, CLAUDE.md invariant) ---
const GRID_START_HOUR = 6; // 06:00 ICT — display window start
const GRID_END_HOUR = 24; // 24:00 ICT (midnight) — display window end
const SLOT_MINUTES = 30;
/** px per 30-min row — the single source of truth both the time axis rows
 * and each court column's absolute-position math derive from. */
const ROW_HEIGHT_PX = 32;
const PX_PER_MINUTE = ROW_HEIGHT_PX / SLOT_MINUTES;
const GRID_HEIGHT_PX = (GRID_END_HOUR - GRID_START_HOUR) * 60 * PX_PER_MINUTE;

/** UTC ISO instant → minutes since ICT midnight (e.g. "18:30" → 1110). */
function ictMinutesSinceMidnight(iso: string): number {
  const [hh, mm] = formatIctTime(iso).split(':').map(Number);
  return hh * 60 + mm;
}

type EventKind = 'ok' | 'info' | 'warn' | 'pay-onsite' | 'danger' | 'hatch';

/**
 * Booking status → event-block color bucket, matching the mockup's D1
 * legend exactly (6 buckets): confirmed/completed → ok; still awaiting the
 * CLIENT (pre-slip, mid-checkout hold) → info ("held"); slip uploaded and
 * awaiting ADMIN review → its own `warn` bucket, distinct from `info` so a
 * held checkout and a review queue don't read as the same thing; an active
 * booking with a cancellation request pending → `danger` (the mockup's own
 * bucket for this — it's the one row on the grid that needs urgent admin
 * attention, so it gets the loudest color, not a muted one). `pay-onsite`
 * has no matching `BookingStatus` value today (that's a `PaymentStatus`,
 * not fetched by the calendar endpoint — see `calendarItemSchema` in
 * `use-admin-bookings.ts`); matched defensively here so a future
 * payment-aware calendar item slots in without a rewrite. Terminal-negative
 * outcomes (rejected/expired/cancelled/no-show) are functionally "the slot
 * is free again" from an admin's POV — same as a maintenance block — so
 * they render as the neutral hatch pattern too, keeping `danger` reserved
 * for the one status that still needs someone to act on it.
 */
function eventKind(status: string): EventKind {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'ok';
    case 'PENDING_VERIFICATION':
    case 'PENDING_PAYMENT':
      return 'info';
    case 'PENDING_PAYMENT_CONFIRMATION':
      return 'warn';
    case 'CANCELLATION_REQUESTED':
      return 'danger';
    case 'PAY_ONSITE_NOT_COLLECTED':
      return 'pay-onsite';
    case 'REJECTED':
    case 'EXPIRED':
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'hatch';
    default:
      return 'hatch';
  }
}

const EVENT_BLOCK_CLASSES: Record<EventKind, string> = {
  ok: 'bg-status-ok text-white',
  info: 'bg-status-info text-white',
  warn: 'bg-status-warn text-white',
  'pay-onsite': 'bg-status-pay-onsite text-white',
  danger: 'bg-status-danger text-white',
  // Neutral diagonal-hatch over surface-3 — reads as "unavailable", never as
  // a solid-color booking block.
  hatch: 'text-fg-muted',
};

const HATCH_BACKGROUND: CSSProperties = {
  backgroundColor: 'var(--surface-3)',
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent, transparent 5px, rgb(0 0 0 / 0.06) 5px, rgb(0 0 0 / 0.06) 10px)',
};

const LEGEND: { kind: EventKind; label: Bilingual }[] = [
  { kind: 'ok', label: { th: 'ยืนยันแล้ว / ชำระแล้ว', en: 'Confirmed / Paid' } },
  { kind: 'warn', label: { th: 'รอตรวจสอบสลิป', en: 'Pending payment review' } },
  { kind: 'info', label: { th: 'จองชั่วคราว (ระหว่างชำระเงิน)', en: 'Held (mid-checkout)' } },
  { kind: 'pay-onsite', label: { th: 'ชำระที่สนาม', en: 'Pay onsite' } },
  { kind: 'danger', label: { th: 'ขอยกเลิกการจอง', en: 'Cancellation requested' } },
  { kind: 'hatch', label: { th: 'ปิดปรับปรุง / ยกเลิกแล้ว / ไม่พร้อมใช้งาน', en: 'Maintenance / cancelled / unavailable' } },
];

/**
 * Admin calendar (Design D1). Courts × time grid for a branch on a date.
 * Each court is an absolutely-positioned column; each booking is a block
 * positioned by its ICT start-offset and sized by its duration on the
 * fixed 30-min lattice, so a 90-min booking renders 3× the height of a
 * 30-min one instead of being confined to a single grid cell.
 */
export default function AdminCalendarPage() {
  const slug = getDevDefaultTenantSlug();
  const { data: branches } = useBranches(slug);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayICT());

  // Auto-select first branch
  const branchId = selectedBranchId || branches?.[0]?.id || '';

  const { data: calendarItems, isLoading } = useAdminCalendar(branchId, selectedDate);

  // Build time-axis labels (30-min grid from 06:00 to 24:00)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
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

  const selectedBranchName = branches?.find((b) => b.id === branchId)?.name;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="ปฏิทิน / Calendar"
        subtitle={
          selectedBranchName
            ? `${selectedBranchName} · ตาราง สนาม × เวลา / Courts × time grid`
            : 'ตาราง สนาม × เวลา / Courts × time grid'
        }
        actions={
          <>
            <select
              value={branchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="rounded-card border border-line-300 bg-surface px-3 py-1.5 text-xs text-fg"
            >
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-card border border-line-300 bg-surface px-1.5 py-1">
              <button
                type="button"
                aria-label="วันก่อนหน้า / Previous day"
                onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                ‹
              </button>
              <label className="sr-only" htmlFor="calendar-date">วันที่ / Date</label>
              <input
                id="calendar-date"
                type="date"
                title={formatDateNavLabel(selectedDate)}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-0 flex-1 min-w-[128px] border-none bg-transparent px-1 font-score text-xs text-fg focus:outline-none"
              />
              <button
                type="button"
                aria-label="วันถัดไป / Next day"
                onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                ›
              </button>
            </div>

            <Link href="/admin/walk-in">
              <Button type="button" variant="primary" size="sm">+ จองหน้างาน / Walk-in booking</Button>
            </Link>
          </>
        }
      />

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

              {/* Body: fixed time axis + one absolutely-positioned column per court */}
              <div className="flex">
                <div className="w-16 shrink-0 border-r border-line-100">
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      style={{ height: ROW_HEIGHT_PX }}
                      className="border-b border-line-100 p-1 font-score text-xs text-fg-muted last:border-b-0"
                    >
                      {slot}
                    </div>
                  ))}
                </div>

                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="relative flex-1 border-r border-line-100 last:border-r-0"
                    style={{
                      height: GRID_HEIGHT_PX,
                      // 30-min gridlines, aligned to the same ROW_HEIGHT_PX as the time axis.
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${ROW_HEIGHT_PX - 1}px, var(--line-100) ${ROW_HEIGHT_PX - 1}px, var(--line-100) ${ROW_HEIGHT_PX}px)`,
                    }}
                  >
                    {calendarItems
                      .filter((item) => item.courtId === court.id)
                      .map((booking) => {
                        const kind = eventKind(booking.status);
                        const startMin = ictMinutesSinceMidnight(booking.startsAt);
                        const durationMin =
                          (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000;
                        const top = Math.max(0, (startMin - GRID_START_HOUR * 60) * PX_PER_MINUTE);
                        const height = Math.max(
                          durationMin * PX_PER_MINUTE - 2,
                          ROW_HEIGHT_PX / 2,
                        );

                        return (
                          <Link
                            key={booking.id}
                            href={`/admin/bookings/${booking.id}`}
                            className={cn(
                              'absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-1 text-[10px] leading-tight shadow-sm',
                              'border-l-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                              kind === 'hatch' ? 'border-line-300' : 'border-white/50',
                              EVENT_BLOCK_CLASSES[kind],
                            )}
                            style={{
                              top,
                              height,
                              ...(kind === 'hatch' ? HATCH_BACKGROUND : undefined),
                            }}
                          >
                            <div className="font-score font-semibold">
                              {formatIctTime(booking.startsAt)}–{formatIctTime(booking.endsAt)}
                            </div>
                            <div className="truncate opacity-90">
                              {booking.memberName ?? booking.memberPhone ?? '—'}
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {calendarItems && courts.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-fg-muted">
          {LEGEND.map(({ kind, label }) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-[3px]',
                  kind !== 'hatch' && EVENT_BLOCK_CLASSES[kind].split(' ')[0],
                )}
                style={kind === 'hatch' ? HATCH_BACKGROUND : undefined}
              />
              {formatBilingual(label)}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-surface-3" />
            {formatBilingual({ th: 'นอกเวลาทำการ', en: 'Closed / outside operating hours' })}
          </span>
        </div>
      )}
    </div>
  );
}
