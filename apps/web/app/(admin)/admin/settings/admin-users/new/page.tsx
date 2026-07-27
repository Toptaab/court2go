import { AdminUserForm } from '@/components/admin/admin-user-form';

/** Create-AdminUser screen (Design D16, PRD A9). */
export default function NewAdminUserPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">ผู้ดูแลใหม่ / New admin user</h1>
      <AdminUserForm />
    </div>
  );
}
