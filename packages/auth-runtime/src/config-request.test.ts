import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadInstanceByHostnameMock, logger, getInstanceConfigMock } = vi.hoisted(() => ({
  loadInstanceByHostnameMock: vi.fn(),
  logger: {
    debug: vi.fn(),
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
  isCanonicalAuthHost: (host: string) =>
    host === getInstanceConfigMock()?.canonicalAuthHost,
}));

const {
  assertActiveRegistryEntry,
  loadRegistryEntryForHost,
  logGlobalAuthResolution,
  logInstanceConfigMissing,
  logTenantAuthResolution,
  resolvePersonalApiAuthBinding,
} = await import('./config-request.js');

const request = new Request('https://tenant.example.test/auth', {
  headers: {
    forwarded: 'host=tenant.example.test',
    host: 'tenant.example.test',
    'x-forwarded-host': 'proxy.example.test',
  },
});

describe('tenant auth request logging helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    loadInstanceByHostnameMock.mockReset();
    logger.debug.mockReset();
    logger.error.mockReset();
    logger.info.mockReset();
    logger.warn.mockReset();
    getInstanceConfigMock.mockReturnValue({
      canonicalAuthHost: 'auth.example.test',
      parentDomain: 'example.test',
    });
  });

  it('logs global, missing-config and tenant resolution summaries', () => {
    logGlobalAuthResolution(request, 'tenant.example.test');
    logInstanceConfigMissing('tenant.example.test');
    logTenantAuthResolution(
      request,
      'tenant.example.test',
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

    expect(logger.debug).toHaveBeenCalledWith(
      'tenant_auth_resolution_summary',
      expect.objectContaining({
        result: 'platform',
        forwarded_header_present: 'true',
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'tenant_auth_resolution_summary',
      expect.objectContaining({
        reason: 'instance_config_missing',
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'tenant_auth_resolution_summary',
      expect.objectContaining({
        result: 'tenant',
        oidc_cache_key_scope: 'tenant_secret',
        issuer_path: '/',
        redirect_path: '/callback',
      })
    );
  });

  it('propagates classified lookup failures without logging below the owning route boundary', async () => {
    loadInstanceByHostnameMock.mockRejectedValueOnce(new TypeError('db down'));
    await expect(loadRegistryEntryForHost('tenant.example.test')).rejects.toMatchObject({
      reason: 'tenant_lookup_failed',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns active registry entries and rejects inactive ones', async () => {
    const activeEntry = {
      instanceId: 'instance-1',
      status: 'active',
      authRealm: 'tenant',
      authClientId: 'client-1',
    };
    loadInstanceByHostnameMock.mockResolvedValueOnce(activeEntry);

    await expect(loadRegistryEntryForHost('tenant.example.test')).resolves.toBe(activeEntry);
    expect(() => assertActiveRegistryEntry('tenant.example.test', activeEntry)).not.toThrow();
    expect(() =>
      assertActiveRegistryEntry('tenant.example.test', {
        ...activeEntry,
        status: 'provisioning',
      })
    ).toThrow('is inactive');
  });

  it('allows only an explicit Kassel provisioning login probe', () => {
    const provisioningEntry = {
      instanceId: 'instance-1',
      status: 'provisioning' as const,
      parentDomain: 'dialog.kassel.de',
      authRealm: 'tenant',
      authClientId: 'client-1',
    };
    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'kassel-traefik-file');

    expect(() =>
      assertActiveRegistryEntry('tenant.dialog.kassel.de', provisioningEntry, {
        allowKasselProvisioningLoginProbe: true,
      })
    ).not.toThrow();
    expect(() =>
      assertActiveRegistryEntry(
        'tenant.example.test',
        { ...provisioningEntry, parentDomain: 'example.test' },
        { allowKasselProvisioningLoginProbe: true }
      )
    ).toThrow('is inactive');
    expect(() => assertActiveRegistryEntry('tenant.dialog.kassel.de', provisioningEntry)).toThrow(
      'is inactive'
    );

    vi.stubEnv('SVA_TENANT_INGRESS_MODE', 'external');
    expect(() =>
      assertActiveRegistryEntry('tenant.dialog.kassel.de', provisioningEntry, {
        allowKasselProvisioningLoginProbe: true,
      })
    ).toThrow('is inactive');
  });
});

describe('personal API auth binding', () => {
  beforeEach(() => {
    loadInstanceByHostnameMock.mockReset();
    getInstanceConfigMock.mockReturnValue({
      canonicalAuthHost: 'auth.example.test',
      parentDomain: 'example.test',
    });
    vi.stubEnv('SVA_AUTH_ISSUER', 'https://id.example/realms/platform');
    vi.stubEnv('SVA_AUTH_CLIENT_ID', 'sva-studio');
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://id.example/');
  });

  it('binds a platform host to the platform issuer and audience', async () => {
    const result = await resolvePersonalApiAuthBinding(
      new Request('https://auth.example.test/api/v1/iam/users')
    );

    expect(result).toEqual({
      issuer: 'https://id.example/realms/platform',
      audience: 'sva-studio',
      scope: { kind: 'platform' },
    });
    expect(loadInstanceByHostnameMock).not.toHaveBeenCalled();
  });

  it('binds an active tenant host to its registry realm and Studio client', async () => {
    loadInstanceByHostnameMock.mockResolvedValue({
      instanceId: 'tenant-a',
      status: 'active',
      parentDomain: 'example.test',
      authRealm: 'tenant-a-realm',
      authIssuerUrl: null,
      authClientId: 'tenant-studio-client',
    });

    const result = await resolvePersonalApiAuthBinding(
      new Request('https://tenant-a.example.test/api/v1/iam/users')
    );

    expect(result).toEqual({
      issuer: 'https://id.example/realms/tenant-a-realm',
      audience: 'tenant-studio-client',
      scope: { kind: 'instance', instanceId: 'tenant-a' },
    });
  });
});
