'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Court } from '@repo/types';
import { useAdminBranches, useAdminCourts, useDeactivateCourt, useDeleteCourt } from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { formatTHB } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

/**
 * Court list (Design D7, PRD A5.1) — filterable by Branch, create/edit/
 * deactivate/soft-delete. Visible to Branch-Admins too (unlike Branches/
 * Sports, `admin-nav.tsx`) since A5.1 lets a Branch-Admin manage Courts
 * within their own Branch; the server enforces the actual scope
 * (403 `BRANCH_SCOPE_DENIED`), this list is unfiltered by role client-side.
 */
export default function AdminCourtsPage() {
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { data: branches } = useAdminBranches();
  const { data: courts, isLoading, isError } = useAdminCourts(branchId);

  const branchName = (id: string) => branches?.find((b) => b.id === id)?.name ?? '—';

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

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load courts.</p>
      )}

      {courts && courts.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">ไม่พบสนาม / No courts found.</p>
      )}

      {courts?.map((court) => (
        <CourtRow key={court.id} court={court} branchName={branchName(court.branchId)} />
      ))}
    </div>
  );
}

function CourtRow({ court, branchName }: { court: Court; branchName: string }) {
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
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/catalog/courts/${court.id}`} className="text-sm font-semibold text-fg hover:underline">
                {court.name}
              </Link>
              {!court.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">
              {branchName} · Grid {court.gridIntervalMinutes} min · Max {court.maxSlots} slots
            </p>
            <p className="mt-0.5 font-score text-xs text-fg-muted">
              {formatTHB(court.basePricePerGridUnit)} / grid unit
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/admin/catalog/courts/${court.id}`}>
            <Button variant="outline" size="sm">แก้ไข / Edit</Button>
          </Link>
          {court.isActive && (
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
