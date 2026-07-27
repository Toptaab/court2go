'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Branch } from '@repo/types';
import {
  useAdminBranches,
  useDeactivateBranch,
  useDeleteBranch,
} from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Branch list (Design D9, PRD A4.1) — create/edit/deactivate/soft-delete.
 * Deactivate is always allowed; soft-delete 409s `SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS`
 * if the Branch still has future bookings, so both actions are offered per row.
 */
export default function AdminBranchesPage() {
  const { data: branches, isLoading, isError } = useAdminBranches();

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

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load branches.</p>
      )}

      {branches && branches.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">ยังไม่มีสาขา / No branches yet.</p>
      )}

      {branches?.map((branch) => <BranchRow key={branch.id} branch={branch} />)}
    </div>
  );
}

function BranchRow({ branch }: { branch: Branch }) {
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
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/catalog/branches/${branch.id}`} className="text-sm font-semibold text-fg hover:underline">
                {branch.name}
              </Link>
              {!branch.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
              <Badge variant={branch.paymentMethod === 'QR_CODE' ? 'accent' : 'pay-onsite'}>
                {branch.paymentMethod === 'QR_CODE' ? 'QR Code' : 'Pay onsite'}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">{branch.address || '—'}</p>
          </div>
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/admin/catalog/branches/${branch.id}`}>
            <Button variant="outline" size="sm">แก้ไข / Edit</Button>
          </Link>
          {branch.isActive && (
            <Button variant="secondary" size="sm" disabled={deactivate.isPending} onClick={handleDeactivate}>
              {deactivate.isPending ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน / Deactivate'}
            </Button>
          )}
          <Button variant="destructive" size="sm" disabled={softDelete.isPending} onClick={handleSoftDelete}>
            {softDelete.isPending ? 'กำลังลบ...' : 'ลบ / Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
