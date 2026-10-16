/** Tests use the released Bus response shape and never contact a real Bus. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBusApiClient } from './bus-api-client.js';

describe('Bus API client', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv('BUS_API_BASE_URL', 'https://bus.example.test');
    vi.stubEnv('BUS_API_ADMIN_TOKEN', 'test-admin-token');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('filters exact labels and projects metadata without secrets or extra fields', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        items: [
          {
            keyId: 'one',
            owner: 'Town',
            label: 'bb-town',
            createdAt: '2026-01-01T00:00:00Z',
            revoked: false,
            hash: 'secret',
            apiKey: 'secret',
          },
          { keyId: 'other', label: 'bb-town-extra' },
          { label: 'BB-town' },
        ],
      })
    );
    expect(await createBusApiClient('actor', 'request').list('bb-town')).toEqual([
      {
        keyId: 'one',
        owner: 'Town',
        label: 'bb-town',
        createdAt: '2026-01-01T00:00:00Z',
        revoked: false,
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://bus.example.test/internal/api-keys?label=bb-town');
    expect(init).toMatchObject({
      redirect: 'error',
      cache: 'no-store',
      headers: { 'x-admin-actor-id': 'actor', 'x-request-id': 'request' },
    });
  });
  it.each(['revoke', 'activate'] as const)('encodes context and omits JSON content type for bodyless %s', async (action) => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await createBusApiClient('actor', 'request').mutate('bb-town', 'a/b?c', action);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `https://bus.example.test/internal/api-keys/a%2Fb%3Fc/${action}?label=bb-town`
    );
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('content-type')).toBe(false);
  });
  it('returns only the one-time key and id after creation', async () => {
    fetchMock.mockResolvedValue(Response.json({ keyId: 'one', apiKey: 'sk_test', hash: 'hidden' }));
    expect(
      await createBusApiClient('actor', 'request').create({
        owner: 'Town',
        label: 'bb-town',
        contact: 'test@example.test',
        createdBy: 'dk',
        expiresAt: '2027-01-01T00:00:00Z',
      })
    ).toEqual({ keyId: 'one', apiKey: 'sk_test' });
  });
  it.each([
    'http://remote.test',
    'https://user:secret@bus.test',
    'https://bus.test/path',
    'https://bus.test?token=secret',
    '',
  ])('rejects unsafe or missing configuration %s', (url) => {
    vi.stubEnv('BUS_API_BASE_URL', url);
    expect(() => createBusApiClient('actor', 'request')).toThrow('bus_not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('limits local HTTP to loopback and the explicit local profile', () => {
    vi.stubEnv('BUS_API_BASE_URL', 'http://localhost:3000');
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'studio');
    expect(() => createBusApiClient('actor', 'request')).toThrow();
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'local-keycloak');
    expect(() => createBusApiClient('actor', 'request')).not.toThrow();
  });
  it.each(['', 'a,b', 'a\tb', 'a'.repeat(257)])('rejects invalid actor assertions', (actor) => {
    expect(() => createBusApiClient(actor, 'request')).toThrow();
  });
  it('times out writes without retries or disclosure of downstream errors', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('secret downstream details'))
          );
        })
    );
    const pending = createBusApiClient('actor', 'request').mutate('bb-town', 'one', 'revoke');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'bus_outcome_unknown' });
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('maps 404 safely', async () => {
    fetchMock.mockResolvedValue(new Response('private data', { status: 404 }));
    await expect(
      createBusApiClient('actor', 'request').mutate('bb-town', 'one', 'activate')
    ).rejects.toMatchObject({ code: 'bus_key_not_found', status: 404 });
  });
  it.each(['.', '..', '', 'bad\nkey'])(
    'rejects unsafe path segments before fetch',
    async (keyId) => {
      await expect(
        createBusApiClient('actor', 'request').mutate('bb-town', keyId, 'revoke')
      ).rejects.toMatchObject({ status: 404 });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});
