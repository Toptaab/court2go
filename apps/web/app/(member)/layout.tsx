import type { ReactNode } from 'react';
import { ThemeContainer } from '@/components/ui/theme-container';

/**
 * Member (logged-in client) shell — same mobile-first column + tenant tint
 * as `(public)`, kept as its own route group (not nested under `(public)`)
 * because M10.4's session/redirect guard hangs off this layout specifically
 * (every route under here requires a Member session; `(public)` routes do
 * not). Visually identical shell today; the guard is the reason it's a
 * separate group.
 *
 * Placeholder page lives at `app/(member)/account/page.tsx` → `/account`
 * (not `/`, to avoid colliding with `(public)`'s root page — Next.js route
 * groups share the URL space of their parent, so two groups can't both
 * resolve `/`). `/account` is a reasonable placeholder for "my
 * bookings"/"profile" (M10.5/M10.4); free to rename once those slices land.
 */
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeContainer className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-8 pt-6">{children}</main>
    </ThemeContainer>
  );
}
