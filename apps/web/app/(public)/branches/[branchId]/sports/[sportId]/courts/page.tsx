'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCourts, useAvailability } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { StepDots } from '@/components/booking/step-dots';
import { Button } from '@/components/ui/button';

// --- Helpers ---

/** Generate an array of dates starting from today for `count` days. */
function getDateRange(count = 14): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/** Format date as YYYY-MM-DD. */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Short weekday (Thai-first, English fallback). */
function shortDay(d: Date): string {
  return d.toLocaleDateString('th-TH', { weekday: 'short' });
}

/** Day of month number. */
function dayNum(d: Date): number {
  return d.getDate();
}

/** Month short name. */
function shortMonth(d: Date): string {
  return d.toLocaleDateString('th-TH', { month: 'short' });
}

/** Format "HH:MM" from a time-of-day string. */
function formatTime(t: string): string {
  return t.slice(0, 5);
}

/**
 * Court + Date + Time Selection — Design M5.
 * Date strip, court tabs, time grid with slot selection.
 * Step 3 of 4 in the booking flow.
 */
export default function CourtSelectionPage() {
  const { branchId, sportId } = useParams<{ branchId: string; sportId: string }>();
  const slug = getDevDefaultTenantSlug();
  const router = useRouter();

  // Fetch courts for this branch, filtered by sport
  const { data: allCourts, isLoading: courtsLoading, isError: courtsError } = useCourts(slug, branchId);

  const courts = useMemo(
    () => allCourts?.filter((c) => c.sportId === sportId) ?? [],
    [allCourts, sportId],
  );

  // Date selection
  const dates = useMemo(() => getDateRange(14), []);
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(dates[0]));

  // Court selection
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);

  // Set first court when data loads
  useEffect(() => {
    if (courts.length > 0 && !selectedCourtId) {
      setSelectedCourtId(courts[0].id);
    }
  }, [courts, selectedCourtId]);

  // Time slot selection
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [slotCount, setSlotCount] = useState<number>(1);

  // Fetch availability for selected court + date
  const { data: availability, isLoading: availLoading } = useAvailability(
    slug,
    selectedCourtId ?? '',
    selectedDate,
  );

  // Date strip scroll ref
  const dateStripRef = useRef<HTMLDivElement>(null);

  // Reset time selection when court or date changes
  useEffect(() => {
    setSelectedStart(null);
    setSlotCount(1);
  }, [selectedCourtId, selectedDate]);

  const selectedSlot = availability?.starts.find((s) => s.startTime === selectedStart);
  const totalPrice = selectedSlot?.pricePerSlotCount[slotCount - 1] ?? 0;
  const gridInterval = availability?.gridIntervalMinutes ?? 30;

  // Loading
  if (courtsLoading) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="h-[38px] w-[38px] animate-pulse rounded-[10px] bg-surface-2" />
          <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (courtsError || !allCourts) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
            aria-label="Go back"
          >
            ←
          </button>
          <span className="text-base font-bold text-fg">Choose court & time</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">
            ไม่สามารถโหลดข้อมูลคอร์ทได้ / Unable to load courts.
          </p>
        </div>
      </div>
    );
  }

  // Empty — no courts for this sport
  if (courts.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
            aria-label="Go back"
          >
            ←
          </button>
          <span className="text-base font-bold text-fg">Choose court & time</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">ไม่มีคอร์ทในกีฬานี้ / No courts available for this sport.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-80px)] flex-col">
      {/* App bar */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
          aria-label="Go back"
        >
          ←
        </button>
        <span className="text-base font-bold text-fg">Choose court & time</span>
        <div className="ml-auto">
          <StepDots total={4} current={3} />
        </div>
      </div>

      {/* Date strip */}
      <div
        ref={dateStripRef}
        className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5 scrollbar-hide"
      >
        {dates.map((d) => {
          const iso = toISODate(d);
          const isActive = iso === selectedDate;
          const isToday = iso === toISODate(new Date());
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDate(iso)}
              className={`flex min-w-[52px] flex-col items-center rounded-xl px-2.5 py-1.5 transition-all ${
                isActive
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
              }`}
            >
              <span className="text-[10px] font-medium uppercase">
                {isToday ? 'Today' : shortDay(d)}
              </span>
              <span className="text-[15px] font-bold leading-tight">{dayNum(d)}</span>
              <span className="text-[10px]">{shortMonth(d)}</span>
            </button>
          );
        })}
      </div>

      {/* Court tabs */}
      {courts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-hide">
          {courts.map((court) => {
            const isActive = court.id === selectedCourtId;
            return (
              <button
                key={court.id}
                type="button"
                onClick={() => setSelectedCourtId(court.id)}
                className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line bg-surface text-fg-muted hover:border-ink-300'
                }`}
              >
                {court.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {availability?.closed ? (
          <div className="rounded-card border border-line bg-surface-2 p-4 text-center">
            <p className="text-sm text-fg-muted">คอร์ทปิดในวันนี้ / Court closed on this day</p>
          </div>
        ) : availLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : availability && availability.starts.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {availability.starts.map((slot) => {
                const isAvailable = slot.maxSlotCount > 0;
                const isSelected = slot.startTime === selectedStart;
                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedStart(slot.startTime);
                      setSlotCount(1);
                    }}
                    className={`flex flex-col items-center justify-center rounded-lg border py-2.5 text-center transition-all ${
                      !isAvailable
                        ? 'cursor-not-allowed border-line bg-surface-2 text-fg-muted/40 line-through'
                        : isSelected
                          ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_var(--accent)_inset]'
                          : 'border-line bg-surface text-fg hover:border-accent/50'
                    }`}
                  >
                    <span className="text-sm font-semibold">{formatTime(slot.startTime)}</span>
                    {isAvailable && (
                      <span className="text-[10px] text-fg-muted">
                        ฿{slot.pricePerSlotCount[0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Duration selector (appears when a time is selected) */}
            {selectedStart && selectedSlot && selectedSlot.maxSlotCount > 1 && (
              <div className="mt-4 rounded-card border border-line bg-surface p-3.5">
                <div className="mb-2 text-xs font-medium text-fg-muted">Duration</div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: selectedSlot.maxSlotCount }).map((_, i) => {
                    const count = i + 1;
                    const minutes = count * gridInterval;
                    const hours = minutes / 60;
                    const label = hours >= 1
                      ? `${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`
                      : `${minutes} min`;
                    const isActive = slotCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setSlotCount(count)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          isActive
                            ? 'border-accent bg-accent text-white'
                            : 'border-line bg-surface-2 text-fg-muted hover:border-accent/50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-card border border-line bg-surface-2 p-4 text-center">
            <p className="text-sm text-fg-muted">ไม่มีช่วงเวลาว่าง / No available time slots</p>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-fg-muted">
          {selectedStart && selectedSlot ? (
            <>
              <span>
                {formatTime(selectedStart)} · {slotCount * gridInterval} min
              </span>
              <span className="font-semibold text-fg">฿{totalPrice}</span>
            </>
          ) : (
            <span>Select a time slot</span>
          )}
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={!selectedStart}
          onClick={() => {
            if (selectedCourtId && selectedStart) {
              const params = new URLSearchParams({
                court: selectedCourtId,
                date: selectedDate,
                start: selectedStart,
                slots: String(slotCount),
              });
              router.push(`/booking/review?${params.toString()}`);
            }
          }}
        >
          {selectedStart ? 'Continue · Review booking' : 'Select a time'}
        </Button>
      </div>
    </div>
  );
}
