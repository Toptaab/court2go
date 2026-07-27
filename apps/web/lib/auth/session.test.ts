import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAdminMe, fetchMe } from './session';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const me = {
  id: '11111111-1111-4111-8111-111111111111',
  phone: '0812345678',
  phoneVerified: true,
  name: null,
  emergencyContact: null,
  sex: null,
  lineBound: false,
  hasLineLogin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const adminMe = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'owner@baseline-club.example',
  name: 'Owner',
  role: 'OWNER',
  branchId: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMe', () => {
  it('returns the parsed Me on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(200, me)));
    await expect(fetchMe()).resolves.toEqual(me);
  });

  it('returns null on a 401 (no/expired session) instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Please log in.' } }),
      ),
    );
    await expect(fetchMe()).resolves.toBeNull();
  });

  it('rethrows on a non-401 failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom.' } }),
      ),
    );
    await expect(fetchMe()).rejects.toThrow('Boom.');
  });
});

describe('fetchAdminMe', () => {
  it('returns the parsed AdminMe on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(200, adminMe)));
    await expect(fetchAdminMe()).resolves.toEqual(adminMe);
  });

  it('returns null on a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Please log in.' } }),
      ),
    );
    await expect(fetchAdminMe()).resolves.toBeNull();
  });
});
