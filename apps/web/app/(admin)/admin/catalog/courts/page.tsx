'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Court } from '@repo/types';
import { useAdminBranches, useAdminCourts, useDeactivateCourt, useDeleteCourt } from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { formatTHB } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SimpleTable, type DataTableColumn } from '@/components/ui/paginated-list';

/**
 * Court list (Design D7, PRD A5.1) — filterable by Branch, create/edit/
 * deactivate/soft-delete. Visible to Branch-Admins too (unlike Branches/
 * Sports, `admin-nav.tsx`) since A5.1 lets a Branch-Admin manage Courts
 * within their own Branch; the server enforces the actual scope
 * (403 `BRANCH_SCOPE_DENIED`), this list is unfiltered by role client-side.
 */
export default function AdminCourtsPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { data: branches } = useAdminBranches();
  const { data: courts, isLoading, isError } = useAdminCourts(branchId);

  const branchName = (id: string) => branches?.find((b) => b.id === id)?.name ?? '—';

  const columns: DataTableColumn<Court>[] = [
    {
      header: 'Court',
      cell: (court) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg">{court.name}</span>
          {!court.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
        </div>
      ),
    },
    {
      header: 'Branch',
      cell: (court) => (
        <span className="text-xs text-fg-muted">
          {branchName(court.branchId)} · Grid {court.gridIntervalMinutes} min · Max {court.maxSlots} slots
        </span>
      ),
    },
    {
      header: 'Price',
      cell: (court) => (
        <span className="font-score text-xs text-fg-muted">{formatTHB(court.basePricePerGridUnit)} / grid unit</span>
      ),
    },
    { header: 'Actions', cell: (court) => <CourtActions court={court} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">สนาม / Courts</h1>
          <p className="text-xs text-fg-muted">จัดการสนามที่เปิดให้จอง / Manage bookable courts.</p>
        </div>
        <Link href="/admin/catalog/courts/new">
          <Button variant="primary" size="sm">+ สนามใหม่ / New court</Button>
        </Link>
      </div>

      <Select
        value={branchId ?? ''}
        onChange={(e) => setBranchId(e.target.value || undefined)}
        className="max-w-xs"
      >
        <option value="">ทุกสาขา / All branches</option>
        {branches?.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </Select>

      <SimpleTable
        items={courts}
        isLoading={isLoading}
        isError={isError}
        columns={columns}
        keyOf={(court) => court.id}
        onRowClick={(court) => router.push(`/admin/catalog/courts/${court.id}`)}
        emptyMessage="ไม่พบสนาม / No courts found."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load courts."
        skeletonCount={3}
        skeletonClassName="h-20"
      />
    </div>
  );
}

function CourtActions({ court }: { court: Court }) {
  const [error, setError] = useState<string | null>(null);
  const deactivate = useDeactivateCourt(court.id);
  const softDelete = useDeleteCourt(court.id);

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
        {court.isActive && (
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
