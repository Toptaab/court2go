'use client';

import { useSearchParams } from 'next/navigation';
import { CourtForm } from '@/components/admin/court-form';

/** Create-Court screen content (Design D7, PRD A5.1). Optional `?branchId=` pre-selects the branch. */
export function NewCourtContent() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get('branchId') ?? undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">สนามใหม่ / New court</h1>
      <CourtForm defaultBranchId={branchId} />
    </div>
  );
}
