import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: {
  ensureRealm: ReturnType<typeof vi.fn>;
  ensureOidcClient: ReturnType<typeof vi.fn>;
  ensureUserAttributeProtocolMapper: ReturnType<typeof vi.fn>;
  ensureRealmRole: ReturnType<typeof vi.fn>;
  findUserByUsername: ReturnType<typeof vi.fn>;
  createUser: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  syncRoles: ReturnType<typeof vi.fn>;
  setUserPassword: ReturnType<typeof vi.fn>;
  setUserRequiredActions: ReturnType<typeof vi.fn>;
  getRealm: ReturnType<typeof vi.fn>;
  getOidcClientByClientId: ReturnType<typeof vi.fn>;
  listClientProtocolMappers: ReturnType<typeof vi.fn>;
  listUserRoleNames: ReturnType<typeof vi.fn>;
  getOidcClientSecretValue: ReturnType<typeof vi.fn>;
  getRoleByName: ReturnType<typeof vi.fn>;
  configCalls: string[];
  clientConfigs: Array<{ realm: string }>;
} = {
  ensureRealm: vi.fn(async () => {}),
  ensureOidcClient: vi.fn(async () => {}),
  ensureUserAttributeProtocolMapper: vi.fn(async () => {}),
  ensureRealmRole: vi.fn(async () => {}),
  findUserByUsername: vi.fn(async () => null),
  createUser: vi.fn(async () => ({ externalId: 'user-1' })),
  updateUser: vi.fn(async () => {}),
  syncRoles: vi.fn(async () => {}),
  setUserPassword: vi.fn(async () => {}),
  setUserRequiredActions: vi.fn(async () => {}),
  getRealm: vi.fn(async () => ({ realm: 'demo' })),
  getOidcClientByClientId: vi.fn(async () => null),
  listClientProtocolMappers: vi.fn(async () => []),
  listUserRoleNames: vi.fn(async () => []),
  getOidcClientSecretValue: vi.fn(async () => null),
  getRoleByName: vi.fn(async (roleName: string) => ({ name: roleName })),
  configCalls: [],
  clientConfigs: [],
};

vi.mock('../keycloak-admin-client.js', () => ({
  KeycloakAdminClient: vi.fn().mockImplementation(function (this: object, config: { realm: string }) {
    state.clientConfigs.push(config);
    return {
      ensureRealm: state.ensureRealm,
      ensureOidcClient: state.ensureOidcClient,
      ensureUserAttributeProtocolMapper: state.ensureUserAttributeProtocolMapper,
      ensureRealmRole: state.ensureRealmRole,
      findUserByUsername: state.findUserByUsername,
      createUser: state.createUser,
      updateUser: state.updateUser,
      syncRoles: state.syncRoles,
      setUserPassword: state.setUserPassword,
      setUserRequiredActions: state.setUserRequiredActions,
      getRealm: state.getRealm,
      getOidcClientByClientId: state.getOidcClientByClientId,
      listClientProtocolMappers: state.listClientProtocolMappers,
      listUserRoleNames: state.listUserRoleNames,
      getOidcClientSecretValue: state.getOidcClientSecretValue,
      getRoleByName: state.getRoleByName,
    };
  }),
  getKeycloakAdminClientConfigFromEnv: vi.fn((realm: string) => {
    state.configCalls.push(realm);
    return { realm };
  }),
}));

import { getInstanceKeycloakStatus, provisionInstanceAuthArtifacts } from './provisioning-auth.js';

describe('provisionInstanceAuthArtifacts', () => {
  beforeEach(() => {
    state.ensureRealm.mockClear();
    state.ensureOidcClient.mockClear();
    state.ensureUserAttributeProtocolMapper.mockClear();
    state.ensureRealmRole.mockClear();
    state.findUserByUsername.mockReset();
    state.findUserByUsername.mockResolvedValue(null);
    state.createUser.mockClear();
    state.updateUser.mockClear();
    state.syncRoles.mockClear();
    state.setUserPassword.mockClear();
    state.setUserRequiredActions.mockClear();
    state.getRealm.mockReset();
    state.getRealm.mockResolvedValue({ realm: 'demo' });
    state.getOidcClientByClientId.mockReset();
    state.getOidcClientByClientId.mockResolvedValue(null);
    state.listClientProtocolMappers.mockReset();
    state.listClientProtocolMappers.mockResolvedValue([]);
    state.listUserRoleNames.mockReset();
    state.listUserRoleNames.mockResolvedValue([]);
    state.getOidcClientSecretValue.mockReset();
    state.getOidcClientSecretValue.mockResolvedValue(null);
    state.getRoleByName.mockReset();
    state.getRoleByName.mockImplementation(async (roleName: string) => ({ name: roleName }));
    state.configCalls = [];
    state.clientConfigs = [];
    delete process.env.SVA_PUBLIC_BASE_URL;
  });

  it('provisions a tenant realm with https defaults', async () => {
    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
    });

    expect(state.configCalls).toEqual(['bb-guben']);
    expect(state.clientConfigs).toEqual([{ realm: 'bb-guben' }]);
    expect(state.ensureRealm).toHaveBeenCalledWith({ displayName: 'bb-guben' });
    expect(state.ensureOidcClient).toHaveBeenCalledWith({
      clientId: 'sva-studio',
      redirectUris: ['https://bb-guben.studio.smart-village.app/auth/callback'],
      postLogoutRedirectUris: ['https://bb-guben.studio.smart-village.app/', '+'],
      webOrigins: ['https://bb-guben.studio.smart-village.app'],
      rootUrl: 'https://bb-guben.studio.smart-village.app',
      clientSecret: undefined,
    });
    expect(state.ensureUserAttributeProtocolMapper).toHaveBeenCalledWith({
      clientId: 'sva-studio',
      name: 'instanceId',
      userAttribute: 'instanceId',
      claimName: 'instanceId',
    });
  });

  it('derives the tenant origin protocol from the public base url and tolerates invalid values', async () => {
    process.env.SVA_PUBLIC_BASE_URL = 'http://localhost:3000';

    await provisionInstanceAuthArtifacts({
      instanceId: 'de-musterhausen',
      primaryHostname: 'de-musterhausen.localhost',
      authRealm: 'de-musterhausen',
      authClientId: 'sva-studio',
    });

    expect(state.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUris: ['http://de-musterhausen.localhost/auth/callback'],
        postLogoutRedirectUris: ['http://de-musterhausen.localhost/', '+'],
        rootUrl: 'http://de-musterhausen.localhost',
      })
    );

    process.env.SVA_PUBLIC_BASE_URL = 'not a url';

    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
    });

    expect(state.ensureOidcClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        redirectUris: ['https://bb-guben.studio.smart-village.app/auth/callback'],
        rootUrl: 'https://bb-guben.studio.smart-village.app',
      })
    );
  });

  it('bootstraps a tenant admin and writes password reset actions', async () => {
    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      authClientSecret: 'test-client-secret',
      tenantAdminBootstrap: {
        username: 'bootstrap-user',
        email: 'bootstrap-user@test.invalid',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      tenantAdminTemporaryPassword: 'test-temp-password',
    });

    expect(state.ensureRealmRole).toHaveBeenCalledWith('system_admin');
    expect(state.ensureRealmRole).toHaveBeenCalledWith('instance_registry_admin');
    expect(state.createUser).toHaveBeenCalledWith({
      username: 'bootstrap-user',
      email: 'bootstrap-user@test.invalid',
      firstName: 'Tenant',
      lastName: 'Admin',
      enabled: true,
      attributes: {
        instanceId: ['bb-guben'],
      },
    });
    expect(state.syncRoles).toHaveBeenCalledWith('user-1', ['system_admin']);
    expect(state.setUserPassword).toHaveBeenCalledWith('user-1', 'test-temp-password', true);
    expect(state.setUserRequiredActions).toHaveBeenCalledWith('user-1', ['UPDATE_PASSWORD']);
  });

  it('updates an existing tenant admin and computes aligned keycloak status', async () => {
    state.findUserByUsername.mockResolvedValue({
      id: 'existing-user',
      email: 'existing@example.org',
      enabled: false,
      attributes: {
        locale: ['de'],
      },
    });
    state.getOidcClientByClientId.mockResolvedValue({
      redirectUris: ['https://bb-guben.studio.smart-village.app/auth/callback'],
      webOrigins: ['https://bb-guben.studio.smart-village.app'],
      attributes: {
        'post.logout.redirect.uris': 'https://bb-guben.studio.smart-village.app/##+',
      },
    });
    state.listClientProtocolMappers.mockResolvedValue([{ name: 'instanceId' }]);
    state.listUserRoleNames.mockResolvedValue(['system_admin']);
    state.getOidcClientSecretValue.mockResolvedValue('test-client-secret');

    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      tenantAdminBootstrap: {
        username: 'bootstrap-user',
      },
    });

    expect(state.updateUser).toHaveBeenCalledWith(
      'existing-user',
      expect.objectContaining({
        username: 'bootstrap-user',
        email: 'existing@example.org',
        enabled: false,
        attributes: {
          locale: ['de'],
          instanceId: ['bb-guben'],
        },
      })
    );
    expect(state.syncRoles).toHaveBeenCalledWith('existing-user', ['system_admin']);

    await expect(
      getInstanceKeycloakStatus({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        authClientSecret: 'test-client-secret',
        tenantAdminBootstrap: {
          username: 'bootstrap-user',
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        realmExists: true,
        clientExists: true,
        instanceIdMapperExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        tenantAdminHasInstanceRegistryAdmin: false,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      })
    );
  });

  it('returns a global fallback status when the realm does not exist', async () => {
    state.getRealm.mockResolvedValue(null);

    await expect(
      getInstanceKeycloakStatus({
        instanceId: 'de-musterhausen',
        primaryHostname: 'de-musterhausen.studio.smart-village.app',
        authRealm: 'de-musterhausen',
        authClientId: 'sva-studio',
        authClientSecretConfigured: false,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        realmExists: false,
        clientExists: false,
        clientSecretConfigured: false,
        tenantClientSecretReadable: false,
        clientSecretAligned: false,
        runtimeSecretSource: 'global',
      })
    );
  });
});
