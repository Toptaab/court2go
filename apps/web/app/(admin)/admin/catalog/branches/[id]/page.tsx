'use client';

import { useParams } from 'next/navigation';
import { useAdminBranch } from '@/lib/hooks/use-admin-catalog';
import { BranchForm } from '@/components/admin/branch-form';

/** Edit-Branch screen (Design D9, PRD A4.1). */
export default function EditBranchPage() {
  const params = useParams<{ id: string }>();
  const { data: branch, isLoading, isError } = useAdminBranch(params.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">แก้ไขสาขา / Edit branch</h1>

      {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load this branch.</p>
      )}

      {branch && <BranchForm initial={branch} />}
    </div>
  );
}
