'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminUser } from '@repo/types';
import { useAdminUsers, useUpdateAdminUser, useDeleteAdminUser } from '@/lib/hooks/use-admin-users';
import { useAdminBranches } from '@/lib/hooks/use-admin-catalog';
import { useAdminMe } from '@/lib/auth/hooks';
import { messageForError } from '@/lib/error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * AdminUser list (Design D16, PRD A9, ADR-0005). Owner/Admin-only screen
 * (nav gates Branch-Admins out entirely). ADR-0005 UI rules applied per row
 * in `AdminUserRow` below — an OWNER row gets no edit/deactivate/delete
 * affordance at all, and only an OWNER may deactivate an ADMIN row.
 */
export default function AdminUsersPage() {
  const { data: adminUsers, isLoading, isError } = useAdminUsers();
  const { data: me } = useAdminMe();
  const { data: branches } = useAdminBranches();

  const branchName = (branchId: string | null) =>
    branchId ? branches?.find((b) => b.id === branchId)?.name ?? branchId : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">ผู้ดูแลระบบ / Admin users</h1>
          <p className="text-xs text-fg-muted">จัดการบัญชีผู้ดูแล / Manage admin accounts.</p>
        </div>
        <Link href="/admin/settings/admin-users/new">
          <Button variant="primary" size="sm">+ ผู้ดูแลใหม่ / New admin user</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load admin users.</p>
      )}

      {adminUsers?.map((au) => (
        <AdminUserRow key={au.id} adminUser={au} myRole={me?.role} branchName={branchName(au.branchId)} />
      ))}
    </div>
  );
}

function AdminUserRow({
  adminUser,
  myRole,
  branchName,
}: {
  adminUser: AdminUser;
  myRole?: string;
  branchName: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const updateAdminUser = useUpdateAdminUser(adminUser.id);
  const deleteAdminUser = useDeleteAdminUser(adminUser.id);

  const isOwnerRow = adminUser.role === 'OWNER';
  // ADR-0005: only OWNER may deactivate an ADMIN.
  const canToggleActive = !isOwnerRow && (myRole === 'OWNER' || adminUser.role !== 'ADMIN');

  const handleToggleActive = async () => {
    setError(null);
    try {
      await updateAdminUser.mutateAsync({ isActive: !adminUser.isActive });
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteAdminUser.mutateAsync();
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
              <span className="text-sm font-semibold text-fg">{adminUser.name}</span>
              <Badge variant={isOwnerRow ? 'accent' : 'neutral'}>{adminUser.role}</Badge>
              {!adminUser.isActive && <Badge variant="danger">ปิดใช้งาน / Inactive</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">{adminUser.email}</p>
            {branchName && <p className="mt-0.5 text-xs text-fg-muted">{branchName}</p>}
          </div>
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}

        {!isOwnerRow && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/admin/settings/admin-users/${adminUser.id}`}>
              <Button variant="outline" size="sm">แก้ไข / Edit</Button>
            </Link>
            {canToggleActive && (
              <Button
                variant="secondary"
                size="sm"
                disabled={updateAdminUser.isPending}
                onClick={handleToggleActive}
              >
                {updateAdminUser.isPending
                  ? 'กำลังบันทึก...'
                  : adminUser.isActive
                    ? 'ปิดใช้งาน / Deactivate'
                    : 'เปิดใช้งาน / Activate'}
              </Button>
            )}
            <Button variant="destructive" size="sm" disabled={deleteAdminUser.isPending} onClick={handleDelete}>
              {deleteAdminUser.isPending ? 'กำลังลบ...' : 'ลบ / Delete'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
