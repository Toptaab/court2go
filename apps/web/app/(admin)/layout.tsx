import type { ReactNode } from 'react';
import { AdminNav } from './admin-nav';

/**
 * Admin console shell — desktop chrome, per docs/DESIGN.md `admin-console.html`.
 *
 * NEUTRAL BY DESIGN: Admin chrome stays neutral (never tenant-tinted); accent
 * only on the brand mark, the active nav icon, the userchip avatar, and
 * primary actions. Uses `ink`/`line`/`surface`/`paper` tokens.
 *
 * Full-bleed desktop layout: fixed sidebar + fluid content area. The sidebar
 * is a full-height flex column (brandrow, then `<AdminNav />` filling the
 * rest via `flex-1`) so the nav's userchip can pin to the bottom with
 * `mt-auto`. The content column sits on `bg-paper`; the sidebar and topbar
 * stay on `bg-surface` (white) divided by the neutral `border-line-100`
 * line. Per-screen titles now live in each page's `<PageHeader>` — this
 * shell's topbar is just a thin neutral bar, no duplicate title.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-paper text-fg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line-100 bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-sm font-extrabold text-accent-ink">
            C
          </span>
          <span className="font-disp text-sm font-bold tracking-tight text-fg">court2go</span>
        </div>
        <AdminNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-line-100 bg-surface px-6" />
        <main className="flex-1 bg-paper p-6">{children}</main>
      </div>
    </div>
  );
}
