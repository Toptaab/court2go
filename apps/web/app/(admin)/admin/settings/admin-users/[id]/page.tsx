'use client';

import { useParams } from 'next/navigation';
import { useAdminUsers } from '@/lib/hooks/use-admin-users';
import { AdminUserForm } from '@/components/admin/admin-user-form';

/**
 * Edit-AdminUser screen (Design D16, PRD A9, ADR-0005). There is no
 * single-AdminUser GET endpoint — the initial value is found from the
 * already-fetched `GET /admin/admin-users` list (same pattern as the Sport
 * and Promotion editors). An OWNER row is never editable through this UI —
 * the list page already hides its edit link, and this page double-checks
 * before rendering the form (a direct URL visit shouldn't slip past it).
 */
export default function EditAdminUserPage() {
  const params = useParams<{ id: string }>();
  const { data: adminUsers, isLoading, isError } = useAdminUsers();
  const adminUser = adminUsers?.find((au) => au.id === params.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">แก้ไขผู้ดูแล / Edit admin user</h1>

      {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load this admin user.</p>
      )}

      {!isLoading && !isError && !adminUser && (
        <p className="text-sm text-status-danger">ไม่พบผู้ดูแลนี้ / This admin user could not be found.</p>
      )}

      {adminUser && adminUser.role === 'OWNER' && (
        <p className="text-sm text-status-danger">ไม่สามารถแก้ไขบัญชีเจ้าของได้ / The Owner account can&apos;t be edited.</p>
      )}

      {adminUser && adminUser.role !== 'OWNER' && <AdminUserForm initial={adminUser} />}
    </div>
  );
}
