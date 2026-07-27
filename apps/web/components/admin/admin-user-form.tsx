'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAdminUserBodySchema,
  updateAdminUserBodySchema,
  type AdminUser,
} from '@repo/types';
import { useAdminBranches } from '@/lib/hooks/use-admin-catalog';
import { useCreateAdminUser, useUpdateAdminUser } from '@/lib/hooks/use-admin-users';
import { useAdminMe } from '@/lib/auth/hooks';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

/** The only two roles ever settable via this UI — ADR-0005: OWNER is never offered. */
type SettableRole = 'ADMIN' | 'BRANCH_ADMIN';

interface AdminUserFormProps {
  /** Present when editing an existing AdminUser; omitted for create. Never an OWNER row (callers must not render this for one). */
  initial?: AdminUser;
}

/**
 * Shared AdminUser create/edit form (Design D16, PRD A9, ADR-0005). Used by
 * both `.../settings/admin-users/new/page.tsx` and `.../[id]/page.tsx`.
 *
 * ADR-0005 UI rules mirrored here (server is the real guard — a slip-through
 * still surfaces cleanly via `messageForError`, never swallowed):
 *  - Role select only ever lists ADMIN/BRANCH_ADMIN — OWNER is never an option.
 *  - branchId is shown/required only when role === BRANCH_ADMIN.
 *  - The `isActive` toggle (edit only) is hidden when the current admin is an
 *    ADMIN (not OWNER) editing ANOTHER Admin — only OWNER may deactivate an Admin.
 *    (A Branch-Admin never reaches this form at all — its nav entry is hidden.)
 */
export function AdminUserForm({ initial }: AdminUserFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const { data: me } = useAdminMe();
  const { data: branches } = useAdminBranches();

  const [email, setEmail] = useState(initial?.email ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SettableRole>((initial?.role as SettableRole) ?? 'ADMIN');
  const [branchId, setBranchId] = useState(initial?.branchId ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const createAdminUser = useCreateAdminUser();
  const updateAdminUser = useUpdateAdminUser(initial?.id ?? '');

  // Only OWNER may deactivate an ADMIN (ADR-0005) — when the acting admin is
  // an ADMIN (not OWNER) and the target row is also an ADMIN, hide the toggle.
  const canToggleActive = !isEdit || me?.role === 'OWNER' || initial?.role !== 'ADMIN';

  const handleSubmit = async () => {
    setError(null);

    if (isEdit) {
      const draft: unknown = {
        name: name.trim(),
        role,
        branchId: role === 'BRANCH_ADMIN' ? branchId || null : null,
        ...(canToggleActive ? { isActive } : {}),
        ...(password.trim() ? { password: password.trim() } : {}),
      };
      const parsed = updateAdminUserBodySchema.safeParse(draft);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
        return;
      }
      try {
        await updateAdminUser.mutateAsync(parsed.data);
        router.push('/admin/settings/admin-users');
      } catch (err) {
        setError(messageForError(err));
      }
      return;
    }

    const draft: unknown = {
      email: email.trim(),
      name: name.trim(),
      password,
      role,
      branchId: role === 'BRANCH_ADMIN' ? branchId || null : null,
    };
    const parsed = createAdminUserBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
      return;
    }
    try {
      await createAdminUser.mutateAsync(parsed.data);
      router.push('/admin/settings/admin-users');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const mutation = isEdit ? updateAdminUser : createAdminUser;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ข้อมูลผู้ดูแล / Admin user details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-user-email">อีเมล / Email</Label>
            <Input
              id="admin-user-email"
              type="email"
              value={email}
              disabled={isEdit}
              onChange={(e) => setEmail(e.target.value)}
            />
            {isEdit && <p className="text-xs text-fg-muted">ไม่สามารถแก้ไขอีเมลได้ / Email cannot be changed.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-user-name">ชื่อ / Name</Label>
            <Input id="admin-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-user-password">
              {isEdit ? 'รหัสผ่านใหม่ (ไม่บังคับ) / New password (optional)' : 'รหัสผ่าน / Password'}
            </Label>
            <Input
              id="admin-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? 'เว้นว่างไว้หากไม่เปลี่ยน / Leave blank to keep current' : undefined}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-user-role">บทบาท / Role</Label>
              {/* ADR-0005: OWNER is NEVER an option here. */}
              <Select
                id="admin-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as SettableRole)}
              >
                <option value="ADMIN">Admin</option>
                <option value="BRANCH_ADMIN">Branch Admin</option>
              </Select>
            </div>
            {role === 'BRANCH_ADMIN' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="admin-user-branch">สาขา / Branch</Label>
                <Select id="admin-user-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">เลือกสาขา / Select branch</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {isEdit && canToggleActive && (
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-line-300 accent-accent"
              />
              เปิดใช้งาน / Active
            </label>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="button" variant="primary" disabled={mutation.isPending} onClick={handleSubmit}>
          {mutation.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก / Save' : 'สร้างผู้ดูแล / Create admin user'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/settings/admin-users')}>
          ยกเลิก / Cancel
        </Button>
      </div>
    </div>
  );
}
