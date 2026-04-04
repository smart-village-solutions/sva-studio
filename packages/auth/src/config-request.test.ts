import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from './types.js';
import type { ResolvedTenantClientSecret } from './config-tenant-secret.js';

const state = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  instanceConfig: {
    canonicalAuthHost: 'studio.smart-village.app',
    parentDomain: 'studio.smart-village.app',
  },
  loadInstanceByHostname: vi.fn(),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: state.loggerInfo,
    warn: state.loggerWarn,
    error: state.loggerError,
  }),
  getInstanceConfig: () => state.instanceConfig,
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceByHostname: (host: string) => state.loadInstanceByHostname(host),
}));

describe('config-request helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.instanceConfig = {
      canonicalAuthHost: 'studio.smart-village.app',
      parentDomain: 'studio.smart-village.app',
    };
    state.loadInstanceByHostname.mockReset();
  });

  it('logs global auth resolution with forwarded request metadata', async () => {
    const { logGlobalAuthResolution } = await import('./config-request.js');
    const request = new Request('https://studio.smart-village.app/auth/login', {
      headers: {
        host: 'bb-guben.studio.smart-village.app',
        'x-forwarded-host': 'bb-guben.studio.smart-village.app',
        forwarded: 'host=bb-guben.studio.smart-village.app;proto=https',
      },
    });

    logGlobalAuthResolution(request, 'bb-guben.studio.smart-village.app', 'https://bb-guben.studio.smart-village.app');

    expect(state.loggerWarn).toHaveBeenCalledWith(
      'tenant_auth_resolution_summary',
      expect.objectContaining({
        host: 'bb-guben.studio.smart-village.app',
        instance_id: 'global',
        auth_realm: 'global',
        secret_source: 'global',
        forwarded_header_present: 'true',
        canonical_auth_host: 'studio.smart-village.app',
      })
    );
  });

  it('logs missing instance config as global fallback', async () => {
    state.instanceConfig = null;
    const { logInstanceConfigMissing } = await import('./config-request.js');

    logInstanceConfigMissing('studio.smart-village.app', 'https://studio.smart-village.app');

    expect(state.loggerInfo).toHaveBeenCalledWith(
      'tenant_auth_resolution_summary',
      expect.objectContaining({
        host: 'studio.smart-village.app',
        result: 'global',
        reason: 'instance_config_missing',
      })
    );
  });

  it('throws and logs when registry hostname lookup fails', async () => {
    state.loadInstanceByHostname.mockRejectedValue(new Error('lookup failed'));
    const { loadRegistryEntryForHost } = await import('./config-request.js');

    await expect(
      loadRegistryEntryForHost('bb-guben.studio.smart-village.app', 'https://bb-guben.studio.smart-village.app')
    ).rejects.toThrow('Tenant auth configuration could not be loaded for bb-guben.studio.smart-village.app');

    expect(state.loggerError).toHaveBeenCalledWith(
      'Tenant hostname lookup failed during auth resolution',
      expect.objectContaining({
        host: 'bb-guben.studio.smart-village.app',
        reason: 'tenant_lookup_failed',
      })
    );
  });

  it('throws for non-active registry entries', async () => {
    const { assertActiveRegistryEntry } = await import('./config-request.js');

    expect(() =>
      assertActiveRegistryEntry('bb-guben.studio.smart-village.app', 'https://bb-guben.studio.smart-village.app', {
        instanceId: 'bb-guben',
        status: 'suspended',
      } as never)
    ).toThrow('Tenant host bb-guben.studio.smart-village.app is not active');

    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Tenant hostname resolved to non-active registry entry',
      expect.objectContaining({
        instance_id: 'bb-guben',
        tenant_status: 'suspended',
      })
    );
  });

  it('logs tenant-specific auth resolution including secret scope', async () => {
    const { logTenantAuthResolution } = await import('./config-request.js');
    const request = new Request('https://bb-guben.studio.smart-village.app/auth/login', {
      headers: {
        host: 'bb-guben.studio.smart-village.app',
      },
    });
    const authConfig: AuthConfig = {
      issuer: 'https://keycloak.example.com/realms/bb-guben',
      clientId: 'sva-studio',
      clientSecret: 'tenant-secret-value',
      redirectUri: 'https://bb-guben.studio.smart-village.app/auth/callback',
      postLogoutRedirectUri: 'https://bb-guben.studio.smart-village.app/',
      scopes: ['openid'],
      authorizationEndpoint: 'https://keycloak.example.com/auth',
      tokenEndpoint: 'https://keycloak.example.com/token',
      userInfoEndpoint: 'https://keycloak.example.com/userinfo',
      endSessionEndpoint: 'https://keycloak.example.com/logout',
      instanceId: 'bb-guben',
      authRealm: 'bb-guben',
      authIssuerUrl: 'https://keycloak.example.com/realms/bb-guben',
    };
    const tenantSecret: ResolvedTenantClientSecret = {
      configured: true,
      readable: true,
      secret: 'tenant-secret-value',
      source: 'tenant',
    };

    logTenantAuthResolution(
      request,
      'bb-guben.studio.smart-village.app',
      'https://bb-guben.studio.smart-village.app',
      authConfig,
      {
        instanceId: 'bb-guben',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
      } as never,
      tenantSecret
    );

    expect(state.loggerInfo).toHaveBeenCalledWith(
      'tenant_auth_resolution_summary',
      expect.objectContaining({
        instance_id: 'bb-guben',
        auth_realm: 'bb-guben',
        secret_source: 'tenant',
        oidc_cache_key_scope: 'tenant_secret',
      })
    );
  });
});
