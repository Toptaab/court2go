'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAdminBranches, useAdminCourt, useAdminSports, useDeactivateCourt } from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { CourtForm } from '@/components/admin/court-form';
import { CourtBlocks } from '@/components/admin/court-blocks';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/** Edit-Court screen (Design D7, PRD A5.1) + maintenance blocks (AC5). */
export default function EditCourtPage() {
  const params = useParams<{ id: string }>();
  const { data: court, isLoading, isError } = useAdminCourt(params.id);
  const { data: branches } = useAdminBranches();
  const { data: sports } = useAdminSports();
  const deactivateCourt = useDeactivateCourt(params.id);

  const [isSaving, setIsSaving] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const handleDeactivate = async () => {
    setDeactivateError(null);
    try {
      await deactivateCourt.mutateAsync();
    } catch (err) {
      setDeactivateError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <>
          <div className="h-10 animate-pulse rounded-card bg-surface-2" />
          <div className="h-64 animate-pulse rounded-card bg-surface-2" />
        </>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load this court.</p>
      )}

      {court && (
        <>
          <PageHeader
            title={court.name}
            subtitle={
              <span className="flex flex-wrap items-center gap-1.5">
                {branches?.find((b) => b.id === court.branchId)?.name ?? '—'} ·{' '}
                {sports?.find((s) => s.id === court.sportId)?.name ?? '—'} ·{' '}
                <Badge variant={court.isActive ? 'ok' : 'neutral'}>
                  {court.isActive ? 'ใช้งาน / Active' : 'ปิดใช้งาน / Inactive'}
                </Badge>
              </span>
            }
            actions={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!court.isActive || deactivateCourt.isPending}
                  onClick={handleDeactivate}
                >
                  {deactivateCourt.isPending ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน / Deactivate'}
                </Button>
                <Button type="submit" form="court-form" variant="primary" size="sm" disabled={isSaving}>
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึก / Save changes'}
                </Button>
              </>
            }
          />
          {deactivateError && <p className="text-sm text-status-danger">{deactivateError}</p>}

          <CourtForm initial={court} hideInlineActions onSubmittingChange={setIsSaving} />
          <div id="court-blocks">
            <CourtBlocks courtId={court.id} />
          </div>
        </>
      )}
    </div>
  );
}
