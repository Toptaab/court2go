'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCourtDetail, useAvailability } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatTHB } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Returns today's date in ICT (UTC+7) as YYYY-MM-DD.
 */
function todayICT(): string {
  const now = new Date();
  // Shift to ICT by adding 7h worth of ms
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return ict.toISOString().slice(0, 10);
}

/**
 * Generate an array of date strings starting from today (ICT) for `count` days.
 */
function dateOptions(count: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  const ictOffset = 7 * 60 * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() + ictOffset + i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Format a date string (YYYY-MM-DD) to a short Thai-friendly label.
 */
function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const day = dayNames[date.getDay()];
  return `${day} ${d}/${m}`;
}

/**
 * Court detail page with date picker + availability grid + slot-count selector
 * + price preview (Design M5). The core booking primitive:
 * - Pick a date
 * - See the start-time grid (free/taken per the court's gridInterval)
 * - Select a start time
 * - Choose slot count (1..maxSlotCount for that start)
 * - See the server-computed price preview
 *
 * Price is DISPLAY ONLY from the server response — never computed client-side.
 */
export default function CourtDetailPage() {
  const params = useParams<{ courtId: string }>();
  const slug = getDevDefaultTenantSlug();

  // Date selection — default to today ICT, show up to 14 days ahead
  const dates = useMemo(() => dateOptions(14), []);
  const [selectedDate, setSelectedDate] = useState(todayICT());

  // Start time + slot count selection
  const [selectedStartIdx, setSelectedStartIdx] = useState<number | null>(null);
  const [selectedSlotCount, setSelectedSlotCount] = useState(1);

  // Data fetching
  const { data: court, isLoading: courtLoading, isError: courtError } = useCourtDetail(slug, params.courtId);
  const { data: availability, isLoading: availLoading } = useAvailability(slug, params.courtId, selectedDate);

  // Reset selection when date changes
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedStartIdx(null);
    setSelectedSlotCount(1);
  };

  // Current selected start info
  const selectedStart = selectedStartIdx !== null ? availability?.starts[selectedStartIdx] : null;

  // Price preview from the server's pricePerSlotCount array
  const pricePreview = selectedStart && selectedSlotCount >= 1
    ? selectedStart.pricePerSlotCount[selectedSlotCount - 1]
    : null;

  // --- Loading state ---
  if (courtLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-10 animate-pulse rounded-card bg-surface-2" />
        <div className="h-48 animate-pulse rounded-card bg-surface-2" />
      </div>
    );
  }

  // --- Not found ---
  if (courtError || !court) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">ไม่พบสนาม / Court not found.</p>
        <Link href="/branches">
          <Button variant="outline" size="sm">← กลับ / Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Back nav */}
      <Link href={`/branches/${court.branchId}/sports`} className="text-sm text-accent hover:underline">
        ← กลับ / Back
      </Link>

      {/* Court header */}
      <div>
        <h1 className="font-disp text-lg font-semibold text-fg">{court.name}</h1>
        <p className="text-xs text-fg-muted">
          {court.gridIntervalMinutes} นาที/ช่วง · สูงสุด {court.maxSlots} ช่วง
        </p>
      </div>

      {/* Date picker — horizontal scroll */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">เลือกวัน / Select date</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => handleDateChange(date)}
              className={cn(
                'flex-shrink-0 rounded-card border px-3 py-2 text-xs transition-colors',
                date === selectedDate
                  ? 'border-accent bg-accent text-white'
                  : 'border-line-100 bg-surface text-fg hover:bg-surface-2',
              )}
            >
              {formatDateLabel(date)}
            </button>
          ))}
        </div>
      </section>

      {/* Availability grid */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">เลือกเวลา / Select time</h2>

        {availLoading && (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        )}

        {availability?.closed && (
          <p className="text-sm text-fg-muted">ปิดทำการวันนี้ / Closed today.</p>
        )}

        {availability && !availability.closed && availability.starts.length === 0 && (
          <p className="text-sm text-fg-muted">ไม่มีช่วงว่าง / No slots available.</p>
        )}

        {availability && !availability.closed && availability.starts.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {availability.starts.map((start, idx) => {
              const isFull = start.maxSlotCount === 0;
              const isSelected = selectedStartIdx === idx;
              return (
                <button
                  key={start.startTime}
                  type="button"
                  disabled={isFull}
                  onClick={() => {
                    setSelectedStartIdx(idx);
                    setSelectedSlotCount(1);
                  }}
                  className={cn(
                    'rounded-card border px-2 py-2 font-score text-xs transition-colors',
                    isFull && 'cursor-not-allowed border-line-100 bg-surface-2 text-ink-300 line-through',
                    !isFull && !isSelected && 'border-line-100 bg-surface text-fg hover:border-accent hover:bg-accent/5',
                    isSelected && 'border-accent bg-accent/10 text-accent font-semibold',
                  )}
                >
                  {start.startTime}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Slot count selector + price preview */}
      {selectedStart && selectedStart.maxSlotCount > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            {/* Slot count */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-fg">
                จำนวนช่วง / Slots
              </h3>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: selectedStart.maxSlotCount }).map((_, i) => {
                  const count = i + 1;
                  const isActive = selectedSlotCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSelectedSlotCount(count)}
                      className={cn(
                        'rounded-card border px-3 py-1.5 font-score text-xs transition-colors',
                        isActive
                          ? 'border-accent bg-accent text-white'
                          : 'border-line-100 bg-surface text-fg hover:border-accent',
                      )}
                    >
                      {count} ({count * availability!.gridIntervalMinutes} นาที)
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price preview */}
            {pricePreview != null && (
              <div className="flex items-baseline justify-between border-t border-line-100 pt-3">
                <span className="text-sm text-fg-muted">ราคา / Price</span>
                <span className="font-score text-lg font-semibold text-accent">
                  {formatTHB(pricePreview)}
                </span>
              </div>
            )}

            {/* Book CTA — links to hold creation in M10.5 */}
            <Button variant="primary" className="w-full" disabled>
              จองสนาม / Book now
            </Button>
            <p className="text-center text-xs text-fg-muted">
              การจองจะพร้อมใช้งานเร็ว ๆ นี้ / Booking coming soon.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
