import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state: {
  instance: { authRealm: string; authClientId: string } | null;
  loadInstanceError: Error | null;
  globalConfigError: Error | null;
  instanceConfigError: Error | null;
  tenantSecret: string | null;
  tenantSecretReadable: boolean;
  clients: Array<{ realm: string; adminRealm?: string; clientId?: string; clientSecret?: string }>;
} = {
  instance: null,
  loadInstanceError: null,
  globalConfigError: null,
  instanceConfigError: null,
  tenantSecret: 'tenant-secret',
  tenantSecretReadable: true,
  clients: [],
};

vi.mock('@sva/data/server', () => ({
  loadInstanceById: vi.fn(async () => {
    if (state.loadInstanceError) {
      throw state.loadInstanceError;
    }
    return state.instance;
  }),
}));

vi.mock('../config-tenant-secret.js', () => ({
  resolveTenantAuthClientSecret: vi.fn(async () => ({
    configured: state.tenantSecret !== null,
    readable: state.tenantSecretReadable,
    secret: state.tenantSecret ?? undefined,
    source: 'tenant',
  })),
}));

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminClient: vi.fn().mockImplementation(function (
    this: object,
    config: { realm: string; adminRealm?: string; clientId?: string; clientSecret?: string }
  ) {
    state.clients.push(config);
    return {
      getCircuitBreakerState: () => 0,
    };
  }),
  getKeycloakAdminClientConfigFromEnv: vi.fn((realm?: string) => {
    if (realm === undefined) {
      if (state.globalConfigError) {
        throw state.globalConfigError;
      }
      return {
        realm: 'global',
        adminRealm: 'platform-root',
        clientId: 'platform-admin',
        clientSecret: 'global-secret',
      };
    }

    if (state.instanceConfigError) {
      throw state.instanceConfigError;
    }

    return {
      realm,
      adminRealm: 'platform-root',
      clientId: 'platform-admin',
      clientSecret: 'global-secret',
    };
  }),
}));

vi.mock('../runtime-secrets.server.js', () => ({
  getIamDatabaseUrl: vi.fn(() => 'postgres://iam'),
}));

vi.mock('../shared/db-helpers.js', () => ({
  createPoolResolver: vi.fn(() => vi.fn()),
  withInstanceDb: vi.fn(),
}));

const importModule = async () => import('./shared-runtime.js');

describe('resolveIdentityProviderForInstance', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.KEYCLOAK_ADMIN_REALM = 'global';
    process.env.KEYCLOAK_ADMIN_BASE_URL = 'https://keycloak.example.test';
    state.instance = null;
    state.loadInstanceError = null;
    state.globalConfigError = null;
    state.instanceConfigError = null;
    state.tenantSecret = 'tenant-secret';
    state.tenantSecretReadable = true;
    state.clients = [];
  });

  afterEach(async () => {
    vi.resetModules();
  });

  it('builds an instance-specific keycloak client when auth realm metadata exists', async () => {
    state.instance = { authRealm: 'bb-guben', authClientId: 'sva-studio' };
    const { resolveIdentityProviderForInstance } = await importModule();

    const result = await resolveIdentityProviderForInstance('bb-guben');

    expect(result?.provider).toBeDefined();
    expect(state.clients).toEqual([
      expect.objectContaining({
        realm: 'bb-guben',
        adminRealm: 'bb-guben',
        clientId: 'sva-studio',
        clientSecret: 'tenant-secret',
      }),
    ]);
    expect(result?.getCircuitBreakerState?.()).toBe(0);
    expect(result?.realm).toBe('bb-guben');
    expect(result?.source).toBe('instance');
    expect(result?.executionMode).toBe('tenant_admin');
  });

  it('returns null when the instance lookup fails for tenant admin resolution', async () => {
    state.loadInstanceError = new Error('db offline');
    const { resolveIdentityProviderForInstance } = await importModule();

    await expect(resolveIdentityProviderForInstance('bb-guben')).resolves.toBeNull();
    expect(state.clients).toEqual([]);
  });

  it('returns null when the tenant-local admin secret is missing', async () => {
    state.instance = { authRealm: 'de-musterhausen', authClientId: 'sva-studio' };
    state.tenantSecret = null;
    const { resolveIdentityProviderForInstance } = await importModule();

    await expect(resolveIdentityProviderForInstance('de-musterhausen')).resolves.toBeNull();
    expect(state.clients).toEqual([]);
  });

  it('uses a break-glass platform admin client explicitly when requested', async () => {
    state.instance = { authRealm: 'de-musterhausen', authClientId: 'sva-studio' };
    process.env.KEYCLOAK_ADMIN_REALM = 'svs-intern-studio-staging';
    const { resolveIdentityProviderForInstance } = await importModule();

    const result = await resolveIdentityProviderForInstance('de-musterhausen', {
      executionMode: 'break_glass',
    });

    expect(result?.provider).toBeDefined();
    expect(state.clients).toEqual([
      {
        realm: 'de-musterhausen',
        adminRealm: 'platform-root',
        clientId: 'platform-admin',
        clientSecret: 'global-secret',
      },
    ]);
    expect(result?.realm).toBe('de-musterhausen');
    expect(result?.source).toBe('instance');
    expect(result?.executionMode).toBe('break_glass');
  });

  it('returns null when no instance auth config can be resolved', async () => {
    const { resolveIdentityProviderForInstance } = await importModule();

    await expect(resolveIdentityProviderForInstance('bb-guben')).resolves.toBeNull();
    expect(state.clients).toEqual([]);
  });

  it('returns null when break-glass client creation fails', async () => {
    state.instance = { authRealm: 'bb-guben', authClientId: 'sva-studio' };
    state.instanceConfigError = new Error('missing keycloak env');
    const { resolveIdentityProviderForInstance } = await importModule();

    await expect(
      resolveIdentityProviderForInstance('bb-guben', {
        executionMode: 'break_glass',
      })
    ).resolves.toBeNull();
    expect(state.clients).toEqual([]);
  });
});
