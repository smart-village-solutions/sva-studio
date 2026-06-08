import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importModule = async () => import('./keycloak-account-action-support.js');

describe('keycloak account action support', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://keycloak.example.test/');
    vi.stubEnv('KEYCLOAK_ADMIN_REALM', 'master');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', 'secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('fails closed when UPDATE_EMAIL is disabled globally and caches the result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'token-1' }))
      .mockResolvedValueOnce(
        Response.json({
          profileInfo: {
            disabledFeatures: ['UPDATE_EMAIL'],
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { isUpdateEmailActionSupported } = await importModule();

    await expect(isUpdateEmailActionSupported('tenant-a')).resolves.toBe(false);
    await expect(isUpdateEmailActionSupported('tenant-a')).resolves.toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns true when UPDATE_EMAIL is enabled for the realm', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'token-1' }))
      .mockResolvedValueOnce(Response.json({ profileInfo: { disabledFeatures: [] } }))
      .mockResolvedValueOnce(
        Response.json([
          {
            alias: 'UPDATE_EMAIL',
            enabled: true,
          },
        ])
      );
    vi.stubGlobal('fetch', fetchMock);

    const { isUpdateEmailActionSupported } = await importModule();

    await expect(isUpdateEmailActionSupported('tenant-b')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('caches fail-closed responses until the ttl expires', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('nope', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const { isUpdateEmailActionSupported } = await importModule();

    await expect(isUpdateEmailActionSupported('tenant-c')).resolves.toBe(false);
    await expect(isUpdateEmailActionSupported('tenant-c')).resolves.toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_001);

    fetchMock
      .mockResolvedValueOnce(Response.json({ access_token: 'token-2' }))
      .mockResolvedValueOnce(Response.json({ profileInfo: { disabledFeatures: [] } }))
      .mockResolvedValueOnce(
        Response.json([
          {
            providerId: 'UPDATE_EMAIL',
            enabled: true,
          },
        ])
      );

    await expect(isUpdateEmailActionSupported('tenant-c')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
