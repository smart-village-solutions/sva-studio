import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadInstanceByHostnameMock, logger, getInstanceConfigMock } = vi.hoisted(() => ({
  loadInstanceByHostnameMock: vi.fn(),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  getInstanceConfigMock: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceByHostname: loadInstanceByHostnameMock,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => logger,
  getInstanceConfig: getInstanceConfigMock,
}));

const {
  assertActiveRegistryEntry,
  loadRegistryEntryForHost,
  logGlobalAuthResolution,
  logInstanceConfigMissing,
  logTenantAuthResolution,
  logTenantAuthResolutionFailure,
} = await import('./config-request.js');

const request = new Request('https://tenant.example.test/auth', {
  headers: {
    forwarded: 'host=tenant.example.test',
    host: 'tenant.example.test',
    'x-forwarded-host': 'proxy.example.test',
  },
});

describe('tenant auth request logging helpers', () => {
  beforeEach(() => {
    loadInstanceByHostnameMock.mockReset();
    logger.error.mockReset();
    logger.info.mockReset();
    logger.warn.mockReset();
    getInstanceConfigMock.mockReturnValue({
      canonicalAuthHost: 'auth.example.test',
      parentDomain: 'example.test',
    });
  });

  it('logs global, missing-config and tenant resolution summaries', () => {
    logGlobalAuthResolution(request, 'tenant.example.test', 'https://tenant.example.test');
    logInstanceConfigMissing('tenant.example.test', 'https://tenant.example.test');
    logTenantAuthResolution(
      request,
      'tenant.example.test',
      'https://tenant.example.test',
      {
        issuer: 'https://issuer.example.test',
        clientId: 'client-1',
        clientSecret: 'secret',
        loginStateSecret: 'login-secret',
        redirectUri: 'https://tenant.example.test/callback',
        postLogoutRedirectUri: 'https://tenant.example.test',
        scopes: 'openid profile',
        sessionCookieName: 'sid',
        loginStateCookieName: 'login-state',
        silentSsoSuppressCookieName: 'sso-suppress',
        sessionTtlMs: 3600,
        sessionRedisTtlBufferMs: 60,
        silentSsoSuppressAfterLogoutMs: 60,
      },
      {
        instanceId: 'instance-1',
        status: 'active',
        authRealm: 'tenant',
        authClientId: 'client-1',
      },
      {
        configured: true,
        readable: true,
        source: 'tenant',
        secret: 'secret',
      }
    );

    expect(logger.warn).toHaveBeenCalledWith('tenant_auth_resolution_summary', expect.objectContaining({
      result: 'platform',
      forwarded_header_present: 'true',
    }));
    expect(logger.info).toHaveBeenCalledWith('tenant_auth_resolution_summary', expect.objectContaining({
      reason: 'instance_config_missing',
    }));
    expect(logger.info).toHaveBeenCalledWith('tenant_auth_resolution_summary', expect.objectContaining({
      result: 'tenant',
      oidc_cache_key_scope: 'tenant_secret',
    }));
  });

  it('logs resolution failures and maps lookup failures to runtime errors', async () => {
    logTenantAuthResolutionFailure(request, {
      host: 'tenant.example.test',
      requestOrigin: 'https://tenant.example.test',
      reason: 'tenant_inactive',
      error: 'inactive',
    });
    expect(logger.error).toHaveBeenCalledWith('tenant_auth_resolution_failed', expect.objectContaining({
      reason: 'tenant_inactive',
      error: 'inactive',
    }));

    loadInstanceByHostnameMock.mockRejectedValueOnce(new TypeError('db down'));
    await expect(loadRegistryEntryForHost('tenant.example.test', 'https://tenant.example.test')).rejects.toMatchObject({
      reason: 'tenant_lookup_failed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Tenant hostname lookup failed during auth resolution',
      expect.objectContaining({ error_type: 'TypeError' })
    );
  });

  it('returns active registry entries and rejects inactive ones', async () => {
    const activeEntry = {
      instanceId: 'instance-1',
      status: 'active',
      authRealm: 'tenant',
      authClientId: 'client-1',
    };
    loadInstanceByHostnameMock.mockResolvedValueOnce(activeEntry);

    await expect(loadRegistryEntryForHost('tenant.example.test', 'https://tenant.example.test')).resolves.toBe(
      activeEntry
    );
    expect(() =>
      assertActiveRegistryEntry('tenant.example.test', 'https://tenant.example.test', activeEntry)
    ).not.toThrow();
    expect(() =>
      assertActiveRegistryEntry('tenant.example.test', 'https://tenant.example.test', {
        ...activeEntry,
        status: 'provisioning',
      })
    ).toThrow('is inactive');
  });
});
