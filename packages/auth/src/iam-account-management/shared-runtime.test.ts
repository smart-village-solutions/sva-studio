import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state: {
  runtimeProfile: string | null;
  instance: { authRealm: string } | null;
  loadInstanceError: Error | null;
  globalConfigError: Error | null;
  instanceConfigError: Error | null;
  clients: Array<{ realm: string }>;
} = {
  runtimeProfile: null,
  instance: null,
  loadInstanceError: null,
  globalConfigError: null,
  instanceConfigError: null,
  clients: [],
};

vi.mock('@sva/sdk', () => ({
  getRuntimeProfileFromEnv: vi.fn(() => state.runtimeProfile),
}));

vi.mock('@sva/data/server', () => ({
  loadInstanceById: vi.fn(async () => {
    if (state.loadInstanceError) {
      throw state.loadInstanceError;
    }
    return state.instance;
  }),
}));

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminClient: vi.fn().mockImplementation(function (this: object, config: { realm: string }) {
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
      return { realm: 'global' };
    }

    if (state.instanceConfigError) {
      throw state.instanceConfigError;
    }

    return { realm };
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
    state.runtimeProfile = null;
    state.instance = null;
    state.loadInstanceError = null;
    state.globalConfigError = null;
    state.instanceConfigError = null;
    state.clients = [];
  });

  afterEach(async () => {
    vi.resetModules();
  });

  it('builds an instance-specific keycloak client when auth realm metadata exists', async () => {
    state.instance = { authRealm: 'bb-guben' };
    const { resolveIdentityProviderForInstance } = await importModule();

    const result = await resolveIdentityProviderForInstance('bb-guben');

    expect(result?.provider).toBeDefined();
    expect(state.clients).toEqual([{ realm: 'bb-guben' }]);
    expect(result?.getCircuitBreakerState?.()).toBe(0);
  });

  it('falls back to the global provider in local profiles when the instance lookup fails', async () => {
    state.runtimeProfile = 'local-keycloak';
    state.loadInstanceError = new Error('db offline');
    const { resolveIdentityProviderForInstance } = await importModule();

    const result = await resolveIdentityProviderForInstance('bb-guben');

    expect(result?.provider).toBeDefined();
    expect(state.clients).toEqual([{ realm: 'global' }]);
  });

  it('falls back to the configured global realm in local profiles when the instance auth realm differs', async () => {
    state.runtimeProfile = 'local-keycloak';
    state.instance = { authRealm: 'de-musterhausen' };
    process.env.KEYCLOAK_ADMIN_REALM = 'svs-intern-studio-staging';
    const { resolveIdentityProviderForInstance } = await importModule();

    const result = await resolveIdentityProviderForInstance('de-musterhausen');

    expect(result?.provider).toBeDefined();
    expect(state.clients).toEqual([{ realm: 'global' }]);
  });

  it('keeps the instance-specific realm in local profiles when it matches the configured admin realm', async () => {
    state.runtimeProfile = 'local-keycloak';
    state.instance = { authRealm: 'de-musterhausen' };
    process.env.KEYCLOAK_ADMIN_REALM = 'de-musterhausen';
    const { resolveIdentityProviderForInstance } = await importModule();

    const result = await resolveIdentityProviderForInstance('de-musterhausen');

    expect(result?.provider).toBeDefined();
    expect(state.clients).toEqual([{ realm: 'de-musterhausen' }]);
  });

  it('returns null in non-local profiles when no instance auth config can be resolved', async () => {
    state.runtimeProfile = 'acceptance-hb';
    process.env.NODE_ENV = 'production';
    const { resolveIdentityProviderForInstance } = await importModule();

    await expect(resolveIdentityProviderForInstance('bb-guben')).resolves.toBeNull();
    expect(state.clients).toEqual([]);
  });

  it('returns null in non-local profiles when realm-specific client creation fails', async () => {
    state.runtimeProfile = 'acceptance-hb';
    process.env.NODE_ENV = 'production';
    state.instance = { authRealm: 'bb-guben' };
    state.instanceConfigError = new Error('missing keycloak env');
    const { resolveIdentityProviderForInstance } = await importModule();

    await expect(resolveIdentityProviderForInstance('bb-guben')).resolves.toBeNull();
    expect(state.clients).toEqual([]);
  });
});
