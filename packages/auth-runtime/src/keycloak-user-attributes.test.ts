import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveIdentityProvider, trackKeycloakCall } from './keycloak-user-attributes.js';

describe('keycloak user attribute reader', () => {
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
  });

  it('resolves a platform provider, caches tokens and filters attributes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'token-1', expires_in: 60 }))
      .mockResolvedValueOnce(
        Response.json({
          attributes: {
            sva_mainserver_user_id: ['user-1'],
            sva_mainserver_password: ['secret'],
          },
        })
      )
      .mockResolvedValueOnce(Response.json({ attributes: { sva_mainserver_user_id: ['user-1'] } }));
    vi.stubGlobal('fetch', fetchMock);

    const resolved = resolveIdentityProvider();

    await expect(
      resolved?.provider.getUserAttributes('external/user', ['sva_mainserver_user_id'])
    ).resolves.toEqual({ sva_mainserver_user_id: ['user-1'] });
    await expect(resolved?.provider.getUserAttributes('external/user')).resolves.toEqual({
      sva_mainserver_user_id: ['user-1'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://keycloak.example.test/realms/master/protocol/openid-connect/token'
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://keycloak.example.test/admin/realms/master/users/external%2Fuser'
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('returns null when required platform env is missing', () => {
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', '');

    expect(resolveIdentityProvider()).toBeNull();
  });

  it('surfaces token and user endpoint errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('nope', { status: 503 })));

    await expect(resolveIdentityProvider()?.provider.getUserAttributes('external-user')).rejects.toThrow(
      'Keycloak fetch_token failed with HTTP 503'
    );

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: 'token-1' }))
        .mockResolvedValueOnce(new Response('nope', { status: 404 }))
    );

    await expect(resolveIdentityProvider()?.provider.getUserAttributes('external-user')).rejects.toThrow(
      'Keycloak get_user_attributes failed with HTTP 404'
    );
  });

  it('executes tracked keycloak calls transparently', async () => {
    await expect(trackKeycloakCall('operation', async () => 'ok')).resolves.toBe('ok');
  });
});
