'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { getQueryClient } from './query';

/**
 * Mounted once in the root layout (`app/layout.tsx`) so every route group —
 * `(public)`, `(member)`, `(admin)` — shares one query cache/client. `useState`
 * (not a module-level constant) is the documented TanStack/Next App Router
 * pattern for this: it guarantees the client is created lazily, once, per
 * component instance, matching `getQueryClient()`'s own per-request-on-
 * server / singleton-in-browser split (`lib/query.ts`) instead of fighting it
 * with React's render semantics.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
