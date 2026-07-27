import type { ZodType, ZodTypeDef } from 'zod';
import type { ApiErrorCode, ErrorEnvelope } from '@repo/types';
import { parseErrorEnvelope } from './error';

/**
 * The one fetch wrapper `apps/web` uses to talk to `apps/api` (ARCHITECTURE
 * §3.2: "a thin typed fetch wrapper: every call parses the response through
 * the matching zod schema from `packages/types` before returning"). Every
 * later slice's `lib/hooks/*` factory and every server-side data fetch calls
 * through `apiFetch`/`apiFetchVoid` — never `fetch` directly — so tenant
 * header, credentials, and error-envelope handling stay in exactly one place.
 *
 * `NEXT_PUBLIC_API_BASE_URL` is public (ships to the browser bundle) because
 * both the browser (client components/hooks) and the Next.js server (RSC
 * data fetches, M10.3+) call `apps/api` directly at this same origin — there
 * is no server-only proxy layer. Defaults to the local `apps/api` dev port
 * (`API_PORT` in `apps/api/src/main.ts`, `.env.example`).
 */
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

/**
 * Thrown on any non-2xx response. Carries the parsed error envelope
 * (ARCHITECTURE §3.4) when the body fit that shape, so callers can branch on
 * `.code` — though per `lib/error.ts`'s own rule, UI code should still go
 * through `messageForError(err)` for display copy rather than switching on
 * `.code` itself.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly envelope: ErrorEnvelope | null;

  constructor(status: number, envelope: ErrorEnvelope | null, fallbackMessage: string) {
    super(envelope?.error.message || fallbackMessage);
    this.name = 'ApiClientError';
    this.status = status;
    this.envelope = envelope;
  }

  /** Convenience accessor — `undefined` when the body wasn't a recognized envelope. */
  get code(): ApiErrorCode | undefined {
    return this.envelope?.error.code as ApiErrorCode | undefined;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-serializable request body. Omit for GET/DELETE-without-body calls. */
  body?: unknown;
  /**
   * Public-endpoint tenant resolution (ARCHITECTURE §2.2): forwarded as the
   * `x-tenant-id` header, whose value is the tenant's URL **slug**, not a
   * UUID (`apps/api`'s `TenantContextMiddleware` resolves it by slug). Omit
   * for admin/member-session-authenticated calls — the session's own
   * `tenantId` always wins server-side regardless of what's sent here.
   */
  tenantSlug?: string;
}

async function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { body, tenantSlug, headers, method, ...rest } = options;
  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    // Carries `c2g_member_session` / `c2g_admin_session` on browser calls.
    // Has no effect on a server-side (RSC) fetch — those must forward the
    // cookie explicitly via `headers` (see `lib/auth/session.ts`), since
    // there is no browser cookie jar during SSR.
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(tenantSlug ? { 'x-tenant-id': tenantSlug } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Best-effort JSON parse of a response body — a network-level failure or an
 * empty body isn't itself a well-formed error envelope, and `parseErrorEnvelope`
 * already treats "not an envelope" as `null`. */
async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function throwForErrorResponse(res: Response): Promise<never> {
  const envelope = parseErrorEnvelope(await safeJson(res));
  throw new ApiClientError(res.status, envelope, res.statusText || 'Request failed');
}

/**
 * Fetch + zod-parse a JSON response. `schema` is mandatory and deliberate —
 * ARCHITECTURE §3.2's "fail loudly on contract drift instead of passing
 * malformed data into the UI" (a `schema.parse` throw here IS that failure).
 *
 * The schema param is typed `ZodType<T, ZodTypeDef, any>` rather than the
 * shorthand `ZodType<T>` (which defaults its Input param to `T` too) —
 * `T` here should only ever bind to a schema's OUTPUT shape (what a parsed
 * response actually looks like); a response schema with a `.default(...)`
 * field (e.g. `configSchema`'s `cancellationCutoffHours`, M10.10) has an
 * Input type that differs from its Output type (the field is optional
 * going in, always-present coming out), and pinning Input to match Output
 * as well makes such a schema fail to typecheck as a `ZodType<T>` argument
 * at all. Loosening only the unused Input slot to `any` fixes that without
 * changing what `T` (and thus every existing caller's inferred response
 * type) resolves to.
 */
export async function apiFetch<T>(
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Input slot deliberately loosened, see doc comment above
  schema: ZodType<T, ZodTypeDef, any>,
  options: ApiFetchOptions = {},
): Promise<T> {
  const res = await rawFetch(path, options);
  if (!res.ok) await throwForErrorResponse(res);
  const json = await safeJson(res);
  return schema.parse(json);
}

/** For endpoints that respond `204 No Content` (logout, delete) — no schema to parse. */
export async function apiFetchVoid(path: string, options: ApiFetchOptions = {}): Promise<void> {
  const res = await rawFetch(path, options);
  if (!res.ok) await throwForErrorResponse(res);
}

/**
 * Builds a `?a=1&b=2` query string from a params object, dropping
 * `undefined`/`null` entries (optional query fields are common across the
 * contract's `*Query` DTOs — e.g. `AvailabilityQuery`, `MyBookingsQuery`).
 * Every later slice's list/query hook uses this rather than hand-building
 * strings so `undefined` filters are omitted consistently.
 */
export function toQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
