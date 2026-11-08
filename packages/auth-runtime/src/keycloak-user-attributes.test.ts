import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveIdentityProvider,
  resolveIdentityProviderForInstance,
  trackKeycloakCall,
} from './keycloak-user-attributes.js';

const state = vi.hoisted(() => ({ loadInstance: vi.fn(), resolveSecret: vi.fn(), warn: vi.fn() }));
vi.mock('@sva/data-repositories/server', () => ({ loadInstanceById: state.loadInstance }));
vi.mock('./config-tenant-secret.js', () => ({
  resolveTenantAdminClientSecret: state.resolveSecret,
}));
vi.mock('@sva/server-runtime', () => ({ createSdkLogger: () => ({ warn: state.warn }) }));

describe('keycloak user attribute reader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

    await expect(
      resolveIdentityProvider()?.provider.getUserAttributes('external-user')
    ).rejects.toThrow('Keycloak fetch_token failed with HTTP 503');

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: 'token-1' }))
        .mockResolvedValueOnce(new Response('nope', { status: 404 }))
    );

    await expect(
      resolveIdentityProvider()?.provider.getUserAttributes('external-user')
    ).rejects.toThrow('Keycloak get_user_attributes failed with HTTP 404');
  });

  it('executes tracked keycloak calls transparently', async () => {
    await expect(trackKeycloakCall('operation', async () => 'ok')).resolves.toBe('ok');
  });

  it('uses only the tenant realm and tenant admin secret', async () => {
    state.loadInstance.mockResolvedValue({
      authRealm: 'tenant/realm',
      tenantAdminClient: { clientId: 'tenant-admin' },
    });
    state.resolveSecret.mockResolvedValue({ secret: 'tenant-secret' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'tenant-token', expires_in: 300 }))
      .mockResolvedValueOnce(
        Response.json({ attributes: { requested: ['value'], private: ['hidden'] } })
      );
    vi.stubGlobal('fetch', fetchMock);
    const resolved = await resolveIdentityProviderForInstance('tenant-id');
    await expect(
      resolved?.provider.getUserAttributes('subject/id', ['requested'])
    ).resolves.toEqual({ requested: ['value'] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://keycloak.example.test/realms/tenant%2Frealm/protocol/openid-connect/token'
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain(
      'client_id=tenant-admin&client_secret=tenant-secret'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://keycloak.example.test/admin/realms/tenant%2Frealm/users/subject%2Fid'
    );
    expect(state.warn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['lookup_failed', 'instance_lookup_failed'],
    ['not_found', 'instance_not_found'],
    ['no_client', 'tenant_admin_client_missing'],
    ['no_secret', 'tenant_admin_client_secret_missing'],
    ['no_config', 'configuration_missing'],
  ])('fails closed with a safe diagnostic for tenant resolution %s', async (scenario, reason) => {
    state.loadInstance.mockResolvedValue({
      authRealm: 'tenant',
      tenantAdminClient: { clientId: 'tenant-admin' },
    });
    state.resolveSecret.mockResolvedValue({ secret: 'sensitive-secret' });
    if (scenario === 'lookup_failed')
      state.loadInstance.mockRejectedValue(new Error('postgres://private:secret@host'));
    if (scenario === 'not_found') state.loadInstance.mockResolvedValue(null);
    if (scenario === 'no_client') state.loadInstance.mockResolvedValue({ authRealm: 'tenant' });
    if (scenario === 'no_secret')
      state.resolveSecret.mockResolvedValue({ reason: 'tenant_admin_client_secret_missing' });
    if (scenario === 'no_config') vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveIdentityProviderForInstance('tenant-id')).resolves.toBeNull();
    expect(state.warn).toHaveBeenCalledWith('keycloak_user_attributes_unavailable', {
      operation: 'resolve_identity_provider',
      reason_code: reason,
      instance_id: 'tenant-id',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(state.warn.mock.calls)).not.toMatch(/private|sensitive|secret@host/);
  });

  it.each(['fetch_token', 'get_user_attributes'] as const)(
    'bounds stalled %s requests and aborts without exposing input',
    async (operation) => {
      const signals: AbortSignal[] = [];
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        signals.push(init?.signal as AbortSignal);
        if (operation === 'get_user_attributes' && signals.length === 1)
          return Promise.resolve(Response.json({ access_token: 'private-token' }));
        return new Promise<Response>(() => undefined);
      });
      vi.stubGlobal('fetch', fetchMock);
      const result = resolveIdentityProvider()?.provider.getUserAttributes('private-subject');
      const rejected = expect(result).rejects.toThrow('Keycloak request timed out');
      await vi.advanceTimersByTimeAsync(10_000);
      await rejected;
      expect(signals.at(-1)?.aborted).toBe(true);
      expect(state.warn).toHaveBeenCalledWith('keycloak_user_attributes_unavailable', {
        operation,
        reason_code: 'timeout',
      });
      expect(JSON.stringify(state.warn.mock.calls)).not.toMatch(/private|https|secret/);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('keeps the timeout active while reading the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => undefined) })
    );
    const result = resolveIdentityProvider()?.provider.getUserAttributes('subject');
    const rejected = expect(result).rejects.toThrow('Keycloak request timed out');
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(state.warn).toHaveBeenCalledWith('keycloak_user_attributes_unavailable', {
      operation: 'fetch_token',
      reason_code: 'timeout',
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('correlates tenant HTTP failures without logging the user, token or response', async () => {
    state.loadInstance.mockResolvedValue({
      authRealm: 'tenant',
      tenantAdminClient: { clientId: 'tenant-admin' },
    });
    state.resolveSecret.mockResolvedValue({ secret: 'private-secret' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: 'private-token' }))
        .mockResolvedValueOnce(new Response('private-response', { status: 403 }))
    );
    const resolved = await resolveIdentityProviderForInstance('tenant-id');
    await expect(resolved?.provider.getUserAttributes('private-subject')).rejects.toThrow(
      'HTTP 403'
    );
    expect(state.warn).toHaveBeenCalledWith('keycloak_user_attributes_unavailable', {
      operation: 'get_user_attributes',
      reason_code: 'http_error',
      http_status: 403,
      instance_id: 'tenant-id',
    });
    expect(JSON.stringify(state.warn.mock.calls)).not.toMatch(/private|https/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, [], { access_token: '' }].map((payload) => ({ payload })))(
    'reports a malformed token response safely: $payload',
    async ({ payload }) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)));
      await expect(
        resolveIdentityProvider()?.provider.getUserAttributes('private-subject')
      ).rejects.toThrow();
      expect(state.warn).toHaveBeenCalledWith('keycloak_user_attributes_unavailable', {
        operation: 'fetch_token',
        reason_code: 'invalid_response',
      });
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each([
    ['http', 'http_error', 401],
    ['network', 'network_error', undefined],
    ['json', 'invalid_response', undefined],
  ] as const)('logs only safe metadata for a %s failure', async (scenario, reason, status) => {
    const fetchMock = vi.fn();
    if (scenario === 'http') fetchMock.mockResolvedValue(new Response('private-body', { status }));
    if (scenario === 'network')
      fetchMock.mockRejectedValue(new Error('https://private-user:secret@host'));
    if (scenario === 'json') fetchMock.mockResolvedValue(new Response('private-json'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      resolveIdentityProvider()?.provider.getUserAttributes('private-subject')
    ).rejects.toThrow();
    expect(state.warn).toHaveBeenCalledWith('keycloak_user_attributes_unavailable', {
      operation: 'fetch_token',
      reason_code: reason,
      ...(status ? { http_status: status } : {}),
    });
    expect(JSON.stringify(state.warn.mock.calls)).not.toMatch(/private|https|secret/);
    expect(vi.getTimerCount()).toBe(0);
  });
});
