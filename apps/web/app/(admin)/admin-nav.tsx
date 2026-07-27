'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminMe } from '@/lib/auth/hooks';
import { useAdminLogout } from '@/lib/hooks/use-admin-auth';
import { cn } from '@/lib/utils';
import type { Role } from '@repo/types';

interface NavItem {
  href: string;
  label: string;
  /** Roles that can see this item. Empty = all roles. */
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'หน้าหลัก / Dashboard', roles: [] },
  { href: '/admin/calendar', label: 'ปฏิทิน / Calendar', roles: [] },
  { href: '/admin/bookings', label: 'การจอง / Bookings', roles: [] },
  { href: '/admin/catalog', label: 'สนาม / Catalog', roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/promotions', label: 'โปรโมชั่น / Promotions', roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/news', label: 'ข่าวสาร / News', roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/members', label: 'สมาชิก / Members', roles: [] },
  { href: '/admin/config', label: 'ตั้งค่า / Settings', roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/admin-users', label: 'ผู้ดูแล / Admin Users', roles: ['OWNER', 'ADMIN'] },
];

/**
 * Role-aware admin sidebar nav. Visibility driven by the admin's role —
 * Branch-Admin sees only bookings/calendar/members; Owner/Admin see all.
 * Server RBAC (403 BRANCH_SCOPE_DENIED) is the real guard — this is UX only.
 */
export function AdminNav() {
  const pathname = usePathname();
  const { data: admin } = useAdminMe();
  const adminLogout = useAdminLogout();

  if (!admin) return null;

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(admin.role as Role),
  );

  const handleLogout = async () => {
    await adminLogout.mutateAsync();
    window.location.href = '/admin/login';
  };

  return (
    <nav className="flex flex-col gap-1 px-2">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-card px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-surface-2 font-medium text-fg'
                : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            {item.label}
          </Link>
        );
      })}

      {/* Separator + user info + logout */}
      <div className="mt-4 border-t border-line-100 pt-3">
        <div className="px-3 py-1">
          <p className="text-xs font-medium text-fg">{admin.name}</p>
          <p className="text-xs text-fg-muted">{admin.role}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 w-full rounded-card px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          ออกจากระบบ / Logout
        </button>
      </div>
    </nav>
  );
}
