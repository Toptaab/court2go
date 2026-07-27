import type { ReactNode } from 'react';

/**
 * Admin console shell — desktop chrome, per docs/DESIGN.md `admin-console.html`.
 *
 * NEUTRAL BY DESIGN (DESIGN.md line 32 / "Notes for frontend build": "Admin
 * chrome stays neutral (never tenant-tinted); accent only on primary
 * actions + branding preview"). This layout deliberately does NOT wrap
 * children in `<ThemeContainer accent={...}>` — the chrome (sidebar nav,
 * page background, borders) uses only `ink`/`line`/`surface` tokens, which
 * are tenant-independent. Individual admin screens may still reach for
 * `bg-accent`/`text-accent` on a specific primary button or the branding
 * preview swatch (D15) — that's an intentionally narrow, per-element use,
 * not a page-level tint.
 *
 * Full-bleed desktop layout (not the mobile-column shell `(public)`/`(member)`
 * use) — a fixed-width sidebar + fluid content area. The sidebar's nav
 * items are added in M10.7 (role-aware nav via `RolesMatrix`); this slice
 * only lays out the two regions.
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
        {/* Role-aware nav (RolesMatrix-driven) lands in M10.7. */}
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
