'use client';

import { useParams } from 'next/navigation';
import { useAdminCourt } from '@/lib/hooks/use-admin-catalog';
import { CourtForm } from '@/components/admin/court-form';
import { CourtBlocks } from '@/components/admin/court-blocks';

/** Edit-Court screen (Design D7, PRD A5.1) + maintenance blocks (AC5). */
export default function EditCourtPage() {
  const params = useParams<{ id: string }>();
  const { data: court, isLoading, isError } = useAdminCourt(params.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">แก้ไขสนาม / Edit court</h1>

      {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load this court.</p>
      )}

      {court && (
        <>
          <CourtForm initial={court} />
          <CourtBlocks courtId={court.id} />
        </>
      )}
    </div>
  );
}
