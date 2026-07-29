import type { ReactNode } from 'react';
import { ThemeContainer } from '@/components/ui/theme-container';
import { AppBar } from '@/components/app-bar';
import { BottomTabBar } from '@/components/bottom-tab-bar';

/**
 * Member (logged-in client) shell — same mobile-first column + tenant tint
 * as `(public)`, kept as its own route group (not nested under `(public)`)
 * because M10.4's session/redirect guard hangs off this layout specifically
 * (every route under here requires a Member session; `(public)` routes do
 * not). Visually identical shell today; the guard is the reason it's a
 * separate group.
 *
 * Layout structure: AppBar (top fixed) → scrollable content → BottomTabBar (bottom fixed)
 */
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeContainer className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <AppBar />
      <main className="flex-1 px-4 pb-16 pt-14">{children}</main>
      <BottomTabBar />
    </ThemeContainer>
  );
}
