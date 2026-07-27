import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch, apiFetchVoid, ApiClientError, toQueryString } from './api-client';

const sampleSchema = z.object({ id: z.string(), name: z.string() });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a successful response through the given zod schema', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: '1', name: 'Baseline Club' }));

    const result = await apiFetch('/tenants/by-slug/baseline-club', sampleSchema);

    expect(result).toEqual({ id: '1', name: 'Baseline Club' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/tenants/by-slug/baseline-club');
    expect(init.credentials).toBe('include');
  });

  it('sends the x-tenant-id header when tenantSlug is given, and Content-Type only when there is a body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: '1', name: 'x' }));

    await apiFetch('/branches', sampleSchema, { tenantSlug: 'baseline-club' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-tenant-id']).toBe('baseline-club');
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('JSON-serializes the body and defaults method to POST when a body is given', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: '1', name: 'x' }));

    await apiFetch('/auth/otp/request', sampleSchema, { body: { phone: '+66812345678' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ phone: '+66812345678' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('throws ApiClientError carrying the parsed envelope on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: 'SLOT_UNAVAILABLE', message: 'Slot taken.' } }),
    );

    const err = await apiFetch('/courts/1/holds', sampleSchema, { body: {} }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('SLOT_UNAVAILABLE');
    expect(err.message).toBe('Slot taken.');
  });

  it('throws ApiClientError with a null envelope when the error body is not a recognizable envelope', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Internal Server Error' }));

    const err = await apiFetch('/whatever', sampleSchema).catch((e) => e);

    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.envelope).toBeNull();
    expect(err.code).toBeUndefined();
    expect(err.message).toBe('Internal Server Error');
  });

  it('throws (zod) on contract drift instead of returning malformed data', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: '1' /* missing name */ }));

    await expect(apiFetch('/branches', sampleSchema)).rejects.toThrow();
  });
});

describe('apiFetchVoid', () => {
  it('resolves without a body on a 204, and throws on a non-2xx status', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetchVoid('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });
});

describe('toQueryString', () => {
  it('builds a query string and omits undefined/null entries', () => {
    expect(toQueryString({ date: '2026-07-27', slotCount: 2, promo: undefined, notes: null })).toBe(
      '?date=2026-07-27&slotCount=2',
    );
  });

  it('returns an empty string when there are no params to include', () => {
    expect(toQueryString({ a: undefined })).toBe('');
  });
});
