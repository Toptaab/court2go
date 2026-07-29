import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Poppins } from 'next/font/google';
import { QueryProvider } from '@/lib/query-provider';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'court2go',
  description: 'Book courts — court2go',
};

/**
 * Root layout. Deliberately thin: the mobile-first client shell and the
 * neutral desktop admin chrome live one level down, in
 * `app/(public)/layout.tsx` / `app/(member)/layout.tsx` /
 * `app/(admin)/layout.tsx` respectively (M10.1 convention — see
 * per-group layouts for why).
 *
 * `suppressHydrationWarning` on <html> is standard practice for a
 * `data-theme` attribute a future client script may set before hydration
 * (theme resolution itself is out of scope for this slice — dark mode
 * today is driven purely by `prefers-color-scheme` in globals.css).
 *
 * `QueryProvider` (M10.2, `lib/query-provider.tsx`) is mounted here — above
 * all three route groups — so `(public)`/`(member)`/`(admin)` client
 * components share one TanStack Query cache/client rather than each group
 * standing up its own.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      <body className="min-h-screen antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
