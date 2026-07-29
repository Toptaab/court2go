'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement, SVGProps } from 'react';
import { useAdminMe } from '@/lib/auth/hooks';
import { useAdminLogout } from '@/lib/hooks/use-admin-auth';
import { cn } from '@/lib/utils';
import type { Role } from '@repo/types';

/**
 * Inline nav icon set — stroke=currentColor, ~17px, copied from the mockup's
 * (admin-console.html) nav markup where a matching item exists (Calendar,
 * Bookings, Slip review, Cancellations, Courts, Branches, Sports, Promotions,
 * Members, News, Config). Dashboard/Walk-in/Admin Users/Roles have no mockup
 * counterpart (LOCAL nav has extra routes) — picked from the same
 * stroke-icon visual family (Feather/Lucide-style, 24×24, strokeWidth 2).
 */
function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </IconBase>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </IconBase>
  );
}

function BookingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </IconBase>
  );
}

function WalkInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </IconBase>
  );
}

function SlipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </IconBase>
  );
}

function CancellationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-9 9z" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

function BranchesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
    </IconBase>
  );
}

function SportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </IconBase>
  );
}

function CourtsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
    </IconBase>
  );
}

function PromotionsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h6" />
      <path d="M15 3h6v6M10 14L21 3" />
    </IconBase>
  );
}

function MembersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </IconBase>
  );
}

function NewsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 22V4a2 2 0 012-2h10l4 4v16" />
      <path d="M8 10h8M8 14h5" />
    </IconBase>
  );
}

function ConfigIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1l2-1.6-2-3.5-2.4 1a7 7 0 00-1.7-1l-.4-2.5H9.6l-.4 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.5L5.1 11a7 7 0 000 2l-2 1.6 2 3.5 2.4-1a7 7 0 001.7 1l.4 2.5h4.8l.4-2.5a7 7 0 001.7-1l2.4 1 2-3.5-2-1.6a7 7 0 00.1-1z" />
    </IconBase>
  );
}

/** Not in the mockup — picked from the same family for the Branding settings item (a palette). */
function BrandingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 22a10 10 0 110-20 8 8 0 018 8c0 2-1 3-3 3h-2a2 2 0 00-1 3.5 1.5 1.5 0 01-1 2.5H12z" />
      <circle cx="7" cy="12" r="1" />
      <circle cx="9" cy="8" r="1" />
      <circle cx="14" cy="7" r="1" />
      <circle cx="17" cy="11" r="1" />
    </IconBase>
  );
}

/** Not in the mockup — a shield, for the Admin Users (RBAC) settings item. */
function AdminUsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </IconBase>
  );
}

/** Not in the mockup — a key, for the Roles matrix settings item. */
function RolesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="15" r="3" />
      <path d="M9.5 12.5L19 3M15 3h4v4" />
    </IconBase>
  );
}

interface NavItem {
  href: string;
  label: string;
  /** Roles that can see this item. Empty = all roles. */
  roles: Role[];
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
  /**
   * Pending-count badge (Slip review / Cancellations). No cheap count-source
   * query exists yet (checked `use-admin-bookings.ts` / `use-admin-booking-
   * actions.ts` / `query-keys.ts` — the list/calendar hooks only return
   * whatever page the caller filters for, nothing shaped like a queue
   * total). Left as an optional, unwired prop rather than fabricated: once a
   * count endpoint/hook exists, pass it here and the badge renders itself.
   */
  count?: number;
}

const OPS_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', roles: [], Icon: DashboardIcon },
  { href: '/admin/calendar', label: 'Calendar', roles: [], Icon: CalendarIcon },
  { href: '/admin/bookings', label: 'Bookings', roles: [], Icon: BookingsIcon },
  { href: '/admin/walk-in', label: 'Walk-in', roles: [], Icon: WalkInIcon },
  { href: '/admin/payments', label: 'Slip review', roles: [], Icon: SlipIcon },
  { href: '/admin/cancellations', label: 'Cancellations', roles: [], Icon: CancellationsIcon },
];

// Catalog + settings group (M10.9/M10.10). Branches/Sports/Promotions/News are
// Owner/Admin-only (tenant-wide config, PRD A3.1/A4.1); Courts and Members
// stay visible to Branch-Admins too (server enforces actual scope via 403
// BRANCH_SCOPE_DENIED). Settings (Config/Branding/Admin Users/Roles) are all
// Owner/Admin-only per PRD A8/A9 — a Branch-Admin never manages other admins
// or tenant-wide settings.
const MANAGE_ITEMS: NavItem[] = [
  { href: '/admin/catalog/branches', label: 'Branches', roles: ['OWNER', 'ADMIN'], Icon: BranchesIcon },
  { href: '/admin/catalog/sports', label: 'Sports', roles: ['OWNER', 'ADMIN'], Icon: SportsIcon },
  { href: '/admin/catalog/courts', label: 'Courts', roles: [], Icon: CourtsIcon },
  { href: '/admin/promotions', label: 'Promotions', roles: ['OWNER', 'ADMIN'], Icon: PromotionsIcon },
  { href: '/admin/news', label: 'News', roles: ['OWNER', 'ADMIN'], Icon: NewsIcon },
  { href: '/admin/members', label: 'Members', roles: [], Icon: MembersIcon },
  { href: '/admin/settings/config', label: 'Config', roles: ['OWNER', 'ADMIN'], Icon: ConfigIcon },
  { href: '/admin/settings/branding', label: 'Branding', roles: ['OWNER', 'ADMIN'], Icon: BrandingIcon },
  {
    href: '/admin/settings/admin-users',
    label: 'Admin Users',
    roles: ['OWNER', 'ADMIN'],
    Icon: AdminUsersIcon,
  },
  { href: '/admin/settings/roles', label: 'Roles', roles: ['OWNER', 'ADMIN'], Icon: RolesIcon },
];

/**
 * Role-aware admin sidebar nav. Visibility driven by the admin's role —
 * Branch-Admin sees only bookings/calendar/members; Owner/Admin see all.
 * Server RBAC (403 BRANCH_SCOPE_DENIED) is the real guard — this is UX only.
 *
 * Rendered as a full-height flex column (the parent `<aside>` is `flex
 * flex-col`, this `<nav>` is `flex-1`) so the bordered userchip card can sit
 * at `mt-auto`, pinned to the bottom regardless of how many nav items are
 * visible for the current role.
 */
export function AdminNav() {
  const pathname = usePathname();
  const { data: admin } = useAdminMe();
  const adminLogout = useAdminLogout();

  if (!admin) return null;

  const isVisible = (item: NavItem) => item.roles.length === 0 || item.roles.includes(admin.role as Role);
  const opsVisible = OPS_ITEMS.filter(isVisible);
  const manageVisible = MANAGE_ITEMS.filter(isVisible);

  const handleLogout = async () => {
    await adminLogout.mutateAsync();
    window.location.href = '/admin/login';
  };

  const renderItem = (item: NavItem) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 rounded-card px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-surface font-semibold text-fg shadow-sm'
            : 'text-fg-muted hover:bg-surface hover:text-fg',
        )}
      >
        <item.Icon
          className={cn('h-[17px] w-[17px] shrink-0', isActive ? 'text-accent' : 'opacity-75')}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {typeof item.count === 'number' && item.count > 0 && (
          <span className="ml-auto shrink-0 rounded-pill bg-status-warn px-1.5 py-0.5 font-score text-[10px] font-bold leading-none text-white">
            {item.count}
          </span>
        )}
      </Link>
    );
  };

  const initial = admin.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3 pt-1">
      <div className="flex flex-col gap-1">{opsVisible.map(renderItem)}</div>

      {manageVisible.length > 0 && (
        <>
          <p className="px-3 pb-1 pt-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
            Manage
          </p>
          <div className="flex flex-col gap-1">{manageVisible.map(renderItem)}</div>
        </>
      )}

      {/* Userchip — pinned to the bottom of the nav column. */}
      <div className="mt-auto flex flex-col gap-2 pt-3">
        <div className="flex items-center gap-2.5 rounded-md border border-line-100 bg-surface px-2.5 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-tint text-xs font-bold text-accent">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-fg">{admin.name}</p>
            <p className="font-mono text-[10px] text-fg-muted">{admin.role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-card px-3 py-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          ออกจากระบบ / Logout
        </button>
      </div>
    </nav>
  );
}
