'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSports, useCourts } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { StepDots } from '@/components/booking/step-dots';
import { Button } from '@/components/ui/button';

/**
 * Sport selection — Design M4.
 * Selectable rows showing sport name, court count, and price range.
 * Step 2 of 4 in the booking flow.
 */
export default function SportSelectionPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const slug = getDevDefaultTenantSlug();
  const { data: sports, isLoading: sportsLoading, isError: sportsError } = useSports(slug, branchId);
  const { data: courts, isLoading: courtsLoading } = useCourts(slug, branchId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

  const isLoading = sportsLoading || courtsLoading;

  // Derive court count and price range per sport from courts data
  const sportMeta = useMemo(() => {
    if (!courts) return {};
    const map: Record<string, { courtCount: number; minPrice: number; maxPrice: number }> = {};
    for (const court of courts) {
      const existing = map[court.sportId];
      if (existing) {
        existing.courtCount += 1;
        existing.minPrice = Math.min(existing.minPrice, court.basePricePerGridUnit);
        existing.maxPrice = Math.max(existing.maxPrice, court.basePricePerGridUnit);
      } else {
        map[court.sportId] = {
          courtCount: 1,
          minPrice: court.basePricePerGridUnit,
          maxPrice: court.basePricePerGridUnit,
        };
      }
    }
    return map;
  }, [courts]);

  const selectedSport = sports?.find((s) => s.id === selectedId);

  function formatPrice(meta: { minPrice: number; maxPrice: number }) {
    if (meta.minPrice === meta.maxPrice) {
      return `฿${meta.minPrice}`;
    }
    return `฿${meta.minPrice}–${meta.maxPrice}`;
  }

  // Loading skeletons
  if (isLoading) {
    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="h-[38px] w-[38px] animate-pulse rounded-[10px] bg-surface-2" />
          <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
        </div>
        {/* Body */}
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (sportsError || !sports) {
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
          <span className="text-base font-bold text-fg">Choose sport</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">
            ไม่สามารถโหลดข้อมูลกีฬาได้ / Unable to load sports.
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (sports.length === 0) {
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
          <span className="text-base font-bold text-fg">Choose sport</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">ไม่มีกีฬาในสาขานี้ / No sports available at this branch.</p>
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
        <span className="text-base font-bold text-fg">Choose sport</span>
        <div className="ml-auto">
          <StepDots total={4} current={2} />
        </div>
      </div>

      {/* Body — selectable rows */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {sports.map((sport) => {
          const isSelected = sport.id === selectedId;
          const meta = sportMeta[sport.id];
          return (
            <button
              key={sport.id}
              type="button"
              onClick={() => setSelectedId(sport.id)}
              className={`flex items-center gap-3 rounded-card border p-3.5 text-left transition-all ${
                isSelected
                  ? 'border-accent bg-accent-050 shadow-[0_0_0_1px_var(--accent)_inset]'
                  : 'border-line bg-surface hover:border-ink-300'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-fg">
                  {sport.name}
                </div>
                {meta && (
                  <div className="mt-0.5 text-xs text-fg-muted">
                    {meta.courtCount} court{meta.courtCount > 1 ? 's' : ''} · from {formatPrice(meta)}
                  </div>
                )}
              </div>
              {/* Sport icon placeholder */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-sm text-accent">
                🏸
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3">
        <Button
          className="w-full"
          size="lg"
          disabled={!selectedId}
          onClick={() => {
            if (selectedId) {
              router.push(`/branches/${branchId}/sports/${selectedId}/courts`);
            }
          }}
        >
          {selectedSport
            ? `Continue · ${selectedSport.name}`
            : 'Select a sport'}
        </Button>
      </div>
    </div>
  );
}
