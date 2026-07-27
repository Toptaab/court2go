import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api-client';

/**
 * Shared TanStack `QueryClient` factory (ARCHITECTURE §3.2). One set of
 * defaults for the whole app: don't retry a 4xx (a `SLOT_UNAVAILABLE`/
 * `VALIDATION_ERROR`/etc. won't succeed by re-sending the same request —
 * only network blips / 5xx are worth TanStack's built-in retry), and a
 * short `staleTime` so the mobile-first client surface doesn't re-fetch on
 * every focus/mount for data that just loaded.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiClientError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

// Module-level singleton, browser-only. Standard Next.js App Router
// TanStack Query pattern: the server must never share one `QueryClient`
// across requests/users (that would leak one visitor's cached data into
// another's response), so `getQueryClient()` hands out a fresh instance
// per call on the server and only memoizes in the browser.
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
