'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Branch } from '@repo/types';
import {
  useAdminBranches,
  useDeactivateBranch,
  useDeleteBranch,
} from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SimpleTable, type DataTableColumn } from '@/components/ui/paginated-list';

/**
 * Branch list (Design D9, PRD A4.1) — create/edit/deactivate/soft-delete.
 * Deactivate is always allowed; soft-delete 409s `SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS`
 * if the Branch still has future bookings, so both actions are offered per row.
 */
export default function AdminBranchesPage() {
  const router = useRouter();
  const { data: branches, isLoading, isError } = useAdminBranches();

  const columns: DataTableColumn<Branch>[] = [
    {
      header: 'Branch',
      cell: (branch) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg">{branch.name}</span>
          {!branch.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
        </div>
      ),
    },
    { header: 'Address', cell: (branch) => <span className="text-xs text-fg-muted">{branch.address || '—'}</span> },
    {
      header: 'Payment',
      cell: (branch) => (
        <Badge variant={branch.paymentMethod === 'QR_CODE' ? 'accent' : 'pay-onsite'}>
          {branch.paymentMethod === 'QR_CODE' ? 'QR Code' : 'Pay onsite'}
        </Badge>
      ),
    },
    { header: 'Actions', cell: (branch) => <BranchActions branch={branch} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">สาขา / Branches</h1>
          <p className="text-xs text-fg-muted">จัดการสาขาของสถานที่ให้บริการ / Manage your venue&apos;s branches.</p>
        </div>
        <Link href="/admin/catalog/branches/new">
          <Button variant="primary" size="sm">+ สาขาใหม่ / New branch</Button>
        </Link>
      </div>

      <SimpleTable
        items={branches}
        isLoading={isLoading}
        isError={isError}
        columns={columns}
        keyOf={(branch) => branch.id}
        onRowClick={(branch) => router.push(`/admin/catalog/branches/${branch.id}`)}
        emptyMessage="ยังไม่มีสาขา / No branches yet."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load branches."
        skeletonCount={3}
        skeletonClassName="h-20"
      />
    </div>
  );
}

function BranchActions({ branch }: { branch: Branch }) {
  const [error, setError] = useState<string | null>(null);
  const deactivate = useDeactivateBranch(branch.id);
  const softDelete = useDeleteBranch(branch.id);

  const handleDeactivate = async () => {
    setError(null);
    try {
      await deactivate.mutateAsync();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleSoftDelete = async () => {
    setError(null);
    try {
      await softDelete.mutateAsync();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
        {branch.isActive && (
          <Button variant="secondary" size="sm" disabled={deactivate.isPending} onClick={handleDeactivate}>
            {deactivate.isPending ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน / Deactivate'}
          </Button>
        )}
        <Button variant="destructive" size="sm" disabled={softDelete.isPending} onClick={handleSoftDelete}>
          {softDelete.isPending ? 'กำลังลบ...' : 'ลบ / Delete'}
        </Button>
      </div>
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}
