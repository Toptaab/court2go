'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { AvailabilityResponse } from '@repo/types';
import { useAvailability } from '@/lib/hooks/use-public-catalog';
import { formatTHB } from '@/lib/format';
import { ictDateOptions, formatIctDateLabel, todayIct } from '@/lib/ict-date';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A fully-resolved start + slot-count + server price, ready for a hold/booking submit. */
export interface AvailabilitySelection {
  startsAt: string;
  startTime: string;
  slotCount: number;
  /** Server-computed total for this start+slotCount (satang) — display/submit only, never recomputed client-side. */
  price: number;
}

function computeSelection(
  availability: AvailabilityResponse | undefined,
  startIdx: number | null,
  slotCount: number,
): AvailabilitySelection | null {
  if (startIdx === null || !availability) return null;
  const start = availability.starts[startIdx];
  if (!start || slotCount < 1 || slotCount > start.maxSlotCount) return null;
  const price = start.pricePerSlotCount[slotCount - 1];
  if (price === undefined) return null;
  return { startsAt: start.startsAt, startTime: start.startTime, slotCount, price };
}

interface AvailabilityPickerProps {
  slug: string;
  courtId: string;
  /** How many day options to show in the date strip (default 14, matches M10.3 court page). */
  daysAhead?: number;
  /** Fires on every date/start/slot-count change with the resolved selection, or `null` while incomplete. */
  onSelectionChange?: (selection: AvailabilitySelection | null) => void;
  /** Rendered inside the price-preview card once a selection is complete (e.g. a booking CTA). */
  footer?: (selection: AvailabilitySelection) => ReactNode;
}

/**
 * Date strip + start-time availability grid + slot-count selector + server
 * price preview (Design M5 / D6). Shared by the public court detail page
 * (M10.3) and the admin walk-in booking page (M10.8) — the exact same
 * "pick a date, see free/taken starts, pick a slot count, see the
 * server-derived price" flow, just fed by different callers. Price is
 * ALWAYS the server's `pricePerSlotCount` value — this component never
 * computes a price itself.
 */
export function AvailabilityPicker({
  slug,
  courtId,
  daysAhead = 14,
  onSelectionChange,
  footer,
}: AvailabilityPickerProps) {
  const dates = useMemo(() => ictDateOptions(daysAhead), [daysAhead]);
  const [selectedDate, setSelectedDate] = useState(todayIct());
  const [selectedStartIdx, setSelectedStartIdx] = useState<number | null>(null);
  const [selectedSlotCount, setSelectedSlotCount] = useState(1);

  const { data: availability, isLoading } = useAvailability(slug, courtId, selectedDate);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedStartIdx(null);
    setSelectedSlotCount(1);
    onSelectionChange?.(null);
  };

  const handleStartSelect = (idx: number) => {
    setSelectedStartIdx(idx);
    setSelectedSlotCount(1);
    onSelectionChange?.(computeSelection(availability, idx, 1));
  };

  const handleSlotCountSelect = (count: number) => {
    setSelectedSlotCount(count);
    onSelectionChange?.(computeSelection(availability, selectedStartIdx, count));
  };

  const selectedStart = selectedStartIdx !== null ? availability?.starts[selectedStartIdx] : null;
  const selection = computeSelection(availability, selectedStartIdx, selectedSlotCount);

  return (
    <div className="flex flex-col gap-5">
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
              {formatIctDateLabel(date)}
            </button>
          ))}
        </div>
      </section>

      {/* Availability grid */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">เลือกเวลา / Select time</h2>

        {isLoading && (
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
                  onClick={() => handleStartSelect(idx)}
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
      {selectedStart && selectedStart.maxSlotCount > 0 && availability && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-fg">จำนวนช่วง / Slots</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: selectedStart.maxSlotCount }).map((_, i) => {
                  const count = i + 1;
                  const isActive = selectedSlotCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleSlotCountSelect(count)}
                      className={cn(
                        'rounded-card border px-3 py-1.5 font-score text-xs transition-colors',
                        isActive
                          ? 'border-accent bg-accent text-white'
                          : 'border-line-100 bg-surface text-fg hover:border-accent',
                      )}
                    >
                      {count} ({count * availability.gridIntervalMinutes} นาที)
                    </button>
                  );
                })}
              </div>
            </div>

            {selection && (
              <div className="flex items-baseline justify-between border-t border-line-100 pt-3">
                <span className="text-sm text-fg-muted">ราคา / Price</span>
                <span className="font-score text-lg font-semibold text-accent">
                  {formatTHB(selection.price)}
                </span>
              </div>
            )}

            {selection && footer?.(selection)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
