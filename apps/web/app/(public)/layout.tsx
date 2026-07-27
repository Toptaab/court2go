import type { ReactNode } from 'react';
import { ThemeContainer } from '@/components/ui/theme-container';

/**
 * Client (public) shell — mobile-first, per docs/DESIGN.md `client-mobile.html`.
 * Single-column, max-width-constrained to a phone-ish column even on wider
 * viewports (the design mockups are mobile-first; the client surface is not
 * meant to reflow to a desktop layout in MVP).
 *
 * This is the tenant-tinted surface: `ThemeContainer` carries `--accent`
 * (currently the platform default; a resolved tenant's brand color plugs in
 * here once tenant resolution lands — M10.2/M10.3, ARCHITECTURE §2.2) down
 * to every public/booking screen.
 *
 * NOTE (routing convention, read before adding routes here): this slice
 * places the placeholder at `app/(public)/page.tsx` → `/`. ARCHITECTURE §1
 * sketches a `(public)/[tenantSlug]/...` tree for the eventual
 * path-based tenant resolution — that dynamic segment is intentionally
 * NOT introduced yet (M10.1 is scaffold-only); it lands with whichever
 * slice wires real tenant resolution (M10.2/M10.3) and is a routing
 * change only, not a layout-shape change.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeContainer className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-8 pt-6">{children}</main>
    </ThemeContainer>
  );
}
