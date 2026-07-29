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
 * `mt-auto`. Per the mockup's `.shell` (`.side` = recessed `--surface-2`,
 * `.main`/`.content` = unset → inherits `.win`'s white `--surface`), the
 * sidebar is the tinted layer and the content column is white — NOT the
 * other way round. This is what makes the active nav item's white pill +
 * shadow pop against the sidebar. Per-screen titles live in each page's
 * `<PageHeader>`, rendered directly at the top of `<main>` — per the
 * mockup's `.main`, there's no separate shell-level topbar chrome above it.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface text-fg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line-100 bg-surface-2 md:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-sm font-extrabold text-accent-ink">
            C
          </span>
          <span className="font-disp text-sm font-bold tracking-tight text-fg">court2go</span>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 flex-1 bg-surface p-6">{children}</main>
    </div>
  );
}
