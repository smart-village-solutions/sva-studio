import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAuthMeSingleFlight, _resetAuthMeSingleFlight, type AuthMeResult } from './auth-me-singleflight';

const makeResponse = (ok: boolean, status: number, body: unknown): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

beforeEach(() => {
  _resetAuthMeSingleFlight();
});

describe('fetchAuthMeSingleFlight', () => {
  it('führt für parallele Aufrufe nur einen einzigen Fetch durch', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(makeResponse(true, 200, { user: { roles: [] } })));

    const [r1, r2] = await Promise.all([
      fetchAuthMeSingleFlight(fetchFn),
      fetchAuthMeSingleFlight(fetchFn),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
    expect(r1.ok).toBe(true);
    expect(r1.status).toBe(200);
  });

  it('liefert für sequenzielle Aufrufe jeweils einen frischen Fetch', async () => {
    const payload1 = { user: { roles: ['editor'] } };
    const payload2 = { user: { roles: ['admin'] } };

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, payload1))
      .mockResolvedValueOnce(makeResponse(true, 200, payload2));

    const r1 = await fetchAuthMeSingleFlight(fetchFn);
    const r2 = await fetchAuthMeSingleFlight(fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(r1.payload).toEqual(payload1);
    expect(r2.payload).toEqual(payload2);
  });

  it('gibt ok=false und payload=null zurück wenn der Fetch nicht erfolgreich ist', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(makeResponse(false, 401, null)));

    const result: AuthMeResult = await fetchAuthMeSingleFlight(fetchFn);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.payload).toBeNull();
  });

  it('parsed den JSON-Body bei erfolgreichem Response', async () => {
    const body = { user: { roles: ['news.read'], permissionActions: ['news.read'] } };
    const fetchFn = vi.fn(() => Promise.resolve(makeResponse(true, 200, body)));

    const result = await fetchAuthMeSingleFlight(fetchFn);

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual(body);
  });

  it('leert den In-Flight-Zustand nach einem Fehler, sodass nachfolgende Aufrufe neu fetchen', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Netzwerkfehler'))
      .mockResolvedValueOnce(makeResponse(true, 200, { user: {} }));

    await expect(fetchAuthMeSingleFlight(fetchFn)).rejects.toThrow('Netzwerkfehler');

    const result = await fetchAuthMeSingleFlight(fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });
});
