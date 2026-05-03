import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  loadInstanceById: vi.fn(),
  getInstanceConfig: vi.fn(),
  isCanonicalAuthHost: vi.fn(),
  classifyHost: vi.fn(),
  isTrafficEnabledInstanceStatus: vi.fn(),
  resolveTenantAuthClientSecret: vi.fn(),
  loadRegistryEntryForHost: vi.fn(),
  assertActiveRegistryEntry: vi.fn(),
  logGlobalAuthResolution: vi.fn(),
  logInstanceConfigMissing: vi.fn(),
  logTenantAuthResolution: vi.fn(),
  logTenantAuthResolutionFailure: vi.fn(),
  buildRequestOriginFromHeaders: vi.fn(),
  resolveEffectiveRequestHost: vi.fn(),
  getAuthClientSecret: vi.fn(),
  getAuthStateSecret: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadInstanceById: state.loadInstanceById,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getInstanceConfig: state.getInstanceConfig,
  isCanonicalAuthHost: state.isCanonicalAuthHost,
}));

vi.mock('@sva/core', () => ({
  classifyHost: state.classifyHost,
  isTrafficEnabledInstanceStatus: state.isTrafficEnabledInstanceStatus,
  normalizeHost: (value: string) => value.toLowerCase(),
}));

vi.mock('./config-request.js', () => ({
  assertActiveRegistryEntry: state.assertActiveRegistryEntry,
  loadRegistryEntryForHost: state.loadRegistryEntryForHost,
  logGlobalAuthResolution: state.logGlobalAuthResolution,
  logInstanceConfigMissing: state.logInstanceConfigMissing,
  logTenantAuthResolution: state.logTenantAuthResolution,
  logTenantAuthResolutionFailure: state.logTenantAuthResolutionFailure,
}));

vi.mock('./config-tenant-secret.js', () => ({
  resolveTenantAuthClientSecret: state.resolveTenantAuthClientSecret,
}));

vi.mock('./request-hosts.js', () => ({
  buildRequestOriginFromHeaders: state.buildRequestOriginFromHeaders,
  resolveEffectiveRequestHost: state.resolveEffectiveRequestHost,
}));

vi.mock('./runtime-secrets.js', () => ({
  getAuthClientSecret: state.getAuthClientSecret,
  getAuthStateSecret: state.getAuthStateSecret,
}));

describe('auth config resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('SVA_AUTH_CLIENT_SECRET', 'platform-secret');
    vi.stubEnv('SVA_AUTH_ISSUER', 'https://auth.example/realms/platform');
    vi.stubEnv('SVA_AUTH_CLIENT_ID', 'studio');
    vi.stubEnv('SVA_AUTH_REDIRECT_URI', 'https://studio.example/auth/callback');
    vi.stubEnv('SVA_AUTH_POST_LOGOUT_REDIRECT_URI', 'https://studio.example/');
    state.getAuthClientSecret.mockReturnValue('platform-secret');
    state.getAuthStateSecret.mockReturnValue('state-secret');
    state.isTrafficEnabledInstanceStatus.mockReturnValue(true);
    state.resolveTenantAuthClientSecret.mockResolvedValue({
      configured: true,
      readable: true,
      source: 'tenant',
      secret: 'tenant-secret',
    });
    state.buildRequestOriginFromHeaders.mockReturnValue('https://tenant.example');
    state.resolveEffectiveRequestHost.mockReturnValue('tenant.example');
    state.classifyHost.mockReturnValue({ kind: 'tenant' });
    state.isCanonicalAuthHost.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds an instance auth config from instance data and keycloak admin base url', async () => {
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://kc.example///');
    state.loadInstanceById.mockResolvedValue({
      instanceId: 'tenant-a',
      primaryHostname: 'tenant.example',
      status: 'active',
      authRealm: 'tenant-a',
      authClientId: 'tenant-client',
      authIssuerUrl: undefined,
    });

    const { resolveAuthConfigForInstance } = await import('./config.js');

    await expect(resolveAuthConfigForInstance('tenant-a')).resolves.toMatchObject({
      kind: 'instance',
      instanceId: 'tenant-a',
      clientSecret: 'tenant-secret',
      issuer: 'https://kc.example/realms/tenant-a',
      clientId: 'tenant-client',
      redirectUri: 'https://tenant.example/auth/callback',
      postLogoutRedirectUri: 'https://tenant.example/',
    });
  });

  it('rejects instance resolution for missing or inactive instances', async () => {
    state.loadInstanceById.mockResolvedValueOnce(null).mockResolvedValueOnce({
      instanceId: 'tenant-a',
      primaryHostname: 'tenant.example',
      status: 'provisioning',
      authRealm: 'tenant-a',
      authClientId: 'tenant-client',
    });
    state.isTrafficEnabledInstanceStatus.mockReturnValue(false);

    const { resolveAuthConfigForInstance } = await import('./config.js');

    await expect(resolveAuthConfigForInstance('tenant-a')).rejects.toThrow(
      'Active instance auth config not found for tenant-a'
    );
    await expect(resolveAuthConfigForInstance('tenant-a')).rejects.toThrow(
      'Active instance auth config not found for tenant-a'
    );
  });

  it('falls back to the platform config when no instance config is available', async () => {
    state.getInstanceConfig.mockReturnValue(null);

    const { resolveAuthConfigForRequest } = await import('./config.js');

    await expect(resolveAuthConfigForRequest(new Request('https://studio.example/auth/login'))).resolves.toMatchObject({
      kind: 'platform',
      clientId: 'studio',
    });
    expect(state.logInstanceConfigMissing).toHaveBeenCalled();
  });

  it('returns the platform config for canonical and root hosts', async () => {
    state.getInstanceConfig.mockReturnValue({
      canonicalAuthHost: 'auth.example',
      parentDomain: 'example',
    });
    state.isCanonicalAuthHost.mockReturnValueOnce(true).mockReturnValueOnce(false);
    state.classifyHost.mockReturnValueOnce({ kind: 'root' });

    const { resolveAuthConfigForRequest } = await import('./config.js');

    await expect(resolveAuthConfigForRequest(new Request('https://auth.example/auth/login'))).resolves.toMatchObject({
      kind: 'platform',
    });
    await expect(resolveAuthConfigForRequest(new Request('https://example/auth/login'))).resolves.toMatchObject({
      kind: 'platform',
    });
    expect(state.logGlobalAuthResolution).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid tenant host resolutions and missing registry entries', async () => {
    state.getInstanceConfig.mockReturnValue({
      canonicalAuthHost: 'auth.example',
      parentDomain: 'example',
    });
    state.isCanonicalAuthHost.mockReturnValue(false);
    state.classifyHost.mockReturnValueOnce({ kind: 'unknown' }).mockReturnValueOnce({ kind: 'tenant' });
    state.loadRegistryEntryForHost.mockResolvedValueOnce(null);

    const { resolveAuthConfigForRequest } = await import('./config.js');

    await expect(resolveAuthConfigForRequest(new Request('https://broken.example/auth/login'))).rejects.toMatchObject({
      reason: 'tenant_host_invalid',
    });
    await expect(resolveAuthConfigForRequest(new Request('https://tenant.example/auth/login'))).rejects.toMatchObject({
      reason: 'tenant_not_found',
    });
    expect(state.logTenantAuthResolutionFailure).toHaveBeenCalledTimes(2);
  });

  it('resolves tenant auth config and applies the public base port for local dev origins', async () => {
    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'https://example.test:3000');
    state.getInstanceConfig.mockReturnValue({
      canonicalAuthHost: 'auth.example.test',
      parentDomain: 'example.test',
    });
    state.loadRegistryEntryForHost.mockResolvedValue({
      instanceId: 'tenant-a',
      status: 'active',
      authRealm: 'tenant-a',
      authClientId: 'tenant-client',
      authIssuerUrl: 'https://issuer.example/realms/tenant-a',
    });
    state.classifyHost.mockReturnValue({ kind: 'tenant' });
    state.buildRequestOriginFromHeaders.mockReturnValue('https://tenant.example.test');
    state.resolveEffectiveRequestHost.mockReturnValue('tenant.example.test');

    const { resolveAuthConfigForRequest } = await import('./config.js');

    await expect(resolveAuthConfigForRequest(new Request('https://tenant.example.test/auth/login'))).resolves.toMatchObject({
      kind: 'instance',
      instanceId: 'tenant-a',
      clientSecret: 'tenant-secret',
      issuer: 'https://issuer.example/realms/tenant-a',
      redirectUri: 'https://tenant.example.test:3000/auth/callback',
      postLogoutRedirectUri: 'https://tenant.example.test:3000/',
    });
    expect(state.assertActiveRegistryEntry).toHaveBeenCalled();
    expect(state.logTenantAuthResolution).toHaveBeenCalled();
  });
});
