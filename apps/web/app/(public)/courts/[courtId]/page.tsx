'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCourtDetail } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { Button } from '@/components/ui/button';
import { AvailabilityPicker } from '@/components/booking/availability-picker';

/**
 * Court detail page with date picker + availability grid + slot-count selector
 * + price preview (Design M5) — the `AvailabilityPicker` shared component
 * (`components/booking/availability-picker.tsx`, reused by the admin walk-in
 * page M10.8) owns that whole flow. This page just supplies the court +
 * renders the (still-disabled, M10.5-hold-not-wired-here) booking CTA.
 *
 * Price is DISPLAY ONLY from the server response — never computed client-side.
 */
export default function CourtDetailPage() {
  const params = useParams<{ courtId: string }>();
  const slug = getDevDefaultTenantSlug();

  const { data: court, isLoading: courtLoading, isError: courtError } = useCourtDetail(slug, params.courtId);

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

      <AvailabilityPicker
        slug={slug}
        courtId={params.courtId}
        footer={() => (
          <div className="flex flex-col gap-1">
            <Button variant="primary" className="w-full" disabled>
              จองสนาม / Book now
            </Button>
            <p className="text-center text-xs text-fg-muted">
              การจองจะพร้อมใช้งานเร็ว ๆ นี้ / Booking coming soon.
            </p>
          </div>
        )}
      />
    </div>
  );
}
