'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBranches } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { StepDots } from '@/components/booking/step-dots';
import { Button } from '@/components/ui/button';

/**
 * Branch selection — Design M3.
 * Selectable rows with status chips, step indicator, back button, continue CTA.
 */
export default function BranchListPage() {
  const slug = getDevDefaultTenantSlug();
  const { data: branches, isLoading, isError } = useBranches(slug);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

  const selectedBranch = branches?.find((b) => b.id === selectedId);

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
  if (isError || !branches) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
          >
            ←
          </button>
          <span className="text-base font-bold text-fg">Choose branch</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">
            ไม่สามารถโหลดข้อมูลสาขาได้ / Unable to load branches.
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (branches.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
          >
            ←
          </button>
          <span className="text-base font-bold text-fg">Choose branch</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">ไม่มีสาขา / No branches available.</p>
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
        <span className="text-base font-bold text-fg">Choose branch</span>
        <div className="ml-auto">
          <StepDots total={4} current={1} />
        </div>
      </div>

      {/* Body — selectable rows */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {branches.map((branch) => {
          const isSelected = branch.id === selectedId;
          return (
            <button
              key={branch.id}
              type="button"
              onClick={() => setSelectedId(branch.id)}
              className={`flex items-center gap-3 rounded-card border p-3.5 text-left transition-all ${
                isSelected
                  ? 'border-accent bg-accent-050 shadow-[0_0_0_1px_var(--accent)_inset]'
                  : 'border-line bg-surface hover:border-ink-300'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-fg">
                  {branch.name}
                </div>
                {branch.address && (
                  <div className="mt-0.5 text-xs text-fg-muted">
                    {branch.address}
                  </div>
                )}
              </div>
              {/* Status chip — always "Open" for listed branches */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-ok/10 px-2 py-1 text-[11px] font-semibold text-status-ok">
                <i className="block h-[7px] w-[7px] rounded-full bg-status-ok" />
                Open
              </span>
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
              router.push(`/branches/${selectedId}/sports`);
            }
          }}
        >
          {selectedBranch
            ? `Continue · ${selectedBranch.name}`
            : 'Select a branch'}
        </Button>
      </div>
    </div>
  );
}
