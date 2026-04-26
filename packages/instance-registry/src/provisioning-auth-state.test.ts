import { describe, expect, it, vi } from 'vitest';

import {
  createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory,
  createProvisionInstanceAuthArtifacts,
  createReadKeycloakState,
  type KeycloakProvisioningClient,
} from './provisioning-auth-state.js';

const createClient = (overrides?: Partial<KeycloakProvisioningClient>): KeycloakProvisioningClient => ({
  ensureRealm: vi.fn(async () => undefined),
  getRealm: vi.fn(async () => ({ realm: 'demo' })),
  getOidcClientByClientId: vi.fn(async (clientId: string) => ({
    id: `${clientId}-id`,
    redirectUris: ['https://demo.example.org/*'],
    attributes: {
      'post.logout.redirect.uris': 'https://demo.example.org/*',
    },
    webOrigins: ['https://demo.example.org'],
    rootUrl: 'https://demo.example.org',
  })),
  getOidcClientSecretValue: vi.fn(async () => 'secret'),
  ensureOidcClient: vi.fn(async () => undefined),
  listClientProtocolMappers: vi.fn(async () => [{ name: 'instanceId' }]),
  ensureUserAttributeProtocolMapper: vi.fn(async () => undefined),
  ensureRealmRole: vi.fn(async () => undefined),
  getRoleByName: vi.fn(async (externalName: string) => ({ externalName })),
  findUserByUsername: vi.fn(async () => null),
  findUserByEmail: vi.fn(async () => null),
  createUser: vi.fn(async () => ({ externalId: 'user-1' })),
  updateUser: vi.fn(async () => undefined),
  syncRoles: vi.fn(async () => undefined),
  setUserPassword: vi.fn(async () => undefined),
  setUserRequiredActions: vi.fn(async () => undefined),
  listUserRoleNames: vi.fn(async () => []),
  ...overrides,
});

describe('provisioning-auth-state', () => {
  it('reads Keycloak state through an injected provisioning client', async () => {
    const client = createClient();
    const readState = createReadKeycloakState(() => client);

    const state = await readState({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: true,
      tenantAdminClient: {
        clientId: 'tenant-admin',
      },
      tenantAdminBootstrap: {
        username: 'tenant-admin',
      },
    });

    expect(state.realm).toEqual({ realm: 'demo' });
    expect(state.clientRepresentation).toEqual(expect.objectContaining({ id: 'sva-studio-id' }));
    expect(client.getOidcClientByClientId).toHaveBeenCalledWith('tenant-admin');
    expect(client.ensureRealm).not.toHaveBeenCalled();
  });

  it('provisions realm, clients, mapper and tenant admin through the injected client', async () => {
    const client = createClient();
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await provision({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecret: 'secret',
      tenantAdminClient: {
        clientId: 'tenant-admin',
      },
      tenantAdminClientSecret: 'tenant-secret',
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant-admin@example.org',
      },
      tenantAdminTemporaryPassword: 'tmp-password',
    });

    expect(client.ensureRealm).toHaveBeenCalledWith({ displayName: 'demo' });
    expect(client.ensureOidcClient).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'sva-studio' }));
    expect(client.ensureOidcClient).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'tenant-admin' }));
    expect(client.ensureUserAttributeProtocolMapper).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'sva-studio', name: 'instanceId' })
    );
    expect(client.createUser).toHaveBeenCalledWith(expect.objectContaining({ username: 'tenant-admin' }));
    expect(client.setUserPassword).toHaveBeenCalledWith('user-1', 'tmp-password', true);
  });

  it('builds provisioning adapters from an injected config resolver and client constructor', async () => {
    const client = createClient();
    const resolveConfig = vi.fn((realm?: string) => ({ realm: realm ?? 'master' }));
    const createClientFromConfig = vi.fn(() => client);
    const factory = createKeycloakProvisioningClientFactory(resolveConfig, createClientFromConfig);
    const adapters = createKeycloakProvisioningAdapters(factory);

    await adapters.readKeycloakState({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
    });

    expect(resolveConfig).toHaveBeenCalledWith('demo');
    expect(createClientFromConfig).toHaveBeenCalledWith({ realm: 'demo' });
    expect(typeof adapters.provisionInstanceAuthArtifacts).toBe('function');
  });
});
