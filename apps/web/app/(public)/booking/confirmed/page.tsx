'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCourtDetail } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { Button } from '@/components/ui/button';

/**
 * Booking Confirmed — Design M11/M12/M13.
 * Shows success state with booking details, QR check-in code,
 * and navigation options.
 */
export default function BookingConfirmedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = getDevDefaultTenantSlug();

  const courtId = searchParams.get('court') ?? '';
  const date = searchParams.get('date') ?? '';
  const startTime = searchParams.get('start') ?? '';
  const slots = parseInt(searchParams.get('slots') ?? '1', 10);

  const { data: court } = useCourtDetail(slug, courtId);

  const gridInterval = court?.gridIntervalMinutes ?? 30;
  const durationMinutes = slots * gridInterval;
  const hours = durationMinutes / 60;
  const durationLabel = hours >= 1
    ? `${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`
    : `${durationMinutes} min`;

  function formatDate(isoDate: string): string {
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('th-TH', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }

  function formatTime(t: string): string {
    return t.slice(0, 5);
  }

  // Calculate end time
  function getEndTime(start: string, minutes: number): string {
    const [h, m] = start.split(':').map(Number);
    const totalMin = h * 60 + m + minutes;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  const endTime = getEndTime(startTime, durationMinutes);

  return (
    <div className="flex min-h-[calc(100dvh-80px)] flex-col">
      {/* Success header */}
      <div className="flex flex-col items-center bg-accent px-4 pb-8 pt-10 text-white">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-xl font-bold">Booking Confirmed!</h1>
        <p className="mt-1 text-sm text-white/80">Your court is reserved</p>
      </div>

      {/* Booking details card */}
      <div className="relative -mt-4 flex-1 rounded-t-2xl bg-paper px-4 pt-6">
        {/* QR Code for check-in */}
        <div className="mb-4 flex flex-col items-center rounded-card border border-line bg-surface p-4">
          <div className="mb-2 text-xs font-medium text-fg-muted">Check-in QR Code</div>
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-xl border border-line bg-white">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" className="text-fg/70">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="14" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M19 14v3m0 3h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-2 text-[11px] text-fg-muted">Show this at the venue for check-in</p>
        </div>

        {/* Summary */}
        <div className="rounded-card border border-line bg-surface p-4">
          <h3 className="mb-3 text-sm font-bold text-fg">Booking details</h3>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Court</span>
              <span className="text-sm font-medium text-fg">{court?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Date</span>
              <span className="text-sm font-medium text-fg">{formatDate(date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Time</span>
              <span className="text-sm font-medium text-fg">
                {formatTime(startTime)} – {endTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Duration</span>
              <span className="text-sm font-medium text-fg">{durationLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Status</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-ok/10 px-2 py-0.5 text-[11px] font-semibold text-status-ok">
                <i className="block h-[6px] w-[6px] rounded-full bg-status-ok" />
                Confirmed
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 space-y-2.5 pb-6">
          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push('/bookings')}
          >
            View my bookings
          </Button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full rounded-card border border-line bg-surface py-3 text-center text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
