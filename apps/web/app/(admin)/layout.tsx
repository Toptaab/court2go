import type { ReactNode } from 'react';
import { AdminNav } from './admin-nav';

/**
 * Admin console shell — desktop chrome, per docs/DESIGN.md `admin-console.html`.
 *
 * NEUTRAL BY DESIGN: Admin chrome stays neutral (never tenant-tinted); accent
 * only on primary actions. Uses `ink`/`line`/`surface` tokens.
 *
 * Full-bleed desktop layout: fixed sidebar + fluid content area.
 * The sidebar nav is role-aware (via AdminNav client component).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <aside className="hidden w-60 shrink-0 border-r border-line-100 bg-surface md:block">
        <div className="px-4 py-5">
          <span className="font-disp text-sm font-semibold tracking-wide text-fg">
            court2go admin
          </span>
        </div>
        <AdminNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-line-100 bg-surface px-6">
          <span className="text-sm text-fg-muted">Admin console</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
