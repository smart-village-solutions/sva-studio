import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: {
  ensureRealm: ReturnType<typeof vi.fn>;
  ensureOidcClient: ReturnType<typeof vi.fn>;
  ensureUserAttributeProtocolMapper: ReturnType<typeof vi.fn>;
  ensureRealmRole: ReturnType<typeof vi.fn>;
  findUserByUsername: ReturnType<typeof vi.fn>;
  findUserByEmail: ReturnType<typeof vi.fn>;
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
  findUserByEmail: vi.fn(async () => null),
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
  KeycloakAdminUnavailableError: class KeycloakAdminUnavailableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'KeycloakAdminUnavailableError';
    }
  },
  KeycloakAdminRequestError: class KeycloakAdminRequestError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly retryable: boolean;

    constructor(input: { message: string; statusCode: number; code: string; retryable: boolean }) {
      super(input.message);
      this.name = 'KeycloakAdminRequestError';
      this.statusCode = input.statusCode;
      this.code = input.code;
      this.retryable = input.retryable;
    }
  },
  KeycloakAdminClient: vi.fn().mockImplementation(function (this: object, config: { realm: string }) {
    state.clientConfigs.push(config);
    return {
      ensureRealm: state.ensureRealm,
      ensureOidcClient: state.ensureOidcClient,
      ensureUserAttributeProtocolMapper: state.ensureUserAttributeProtocolMapper,
      ensureRealmRole: state.ensureRealmRole,
      findUserByUsername: state.findUserByUsername,
      findUserByEmail: state.findUserByEmail,
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
  getKeycloakProvisionerClientConfigFromEnv: vi.fn((realm: string) => {
    state.configCalls.push(realm);
    return { realm };
  }),
}));

import {
  getInstanceKeycloakPlan,
  getInstanceKeycloakPreflight,
  getInstanceKeycloakStatus,
  provisionInstanceAuthArtifacts,
} from './provisioning-auth.js';
import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';

describe('provisionInstanceAuthArtifacts', () => {
  beforeEach(() => {
    state.ensureRealm.mockClear();
    state.ensureOidcClient.mockClear();
    state.ensureUserAttributeProtocolMapper.mockClear();
    state.ensureRealmRole.mockClear();
    state.findUserByUsername.mockReset();
    state.findUserByUsername.mockResolvedValue(null);
    state.findUserByEmail.mockReset();
    state.findUserByEmail.mockResolvedValue(null);
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
      realmMode: 'new',
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
      rotateClientSecret: undefined,
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
      realmMode: 'new',
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
      realmMode: 'new',
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

  it('rethrows non-recoverable user creation errors during tenant admin bootstrap', async () => {
    state.createUser.mockRejectedValueOnce(
      new KeycloakAdminRequestError({
        message: 'upstream failed',
        statusCode: 503,
        code: 'service_unavailable',
        retryable: true,
      })
    );

    await expect(
      provisionInstanceAuthArtifacts({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'new',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        tenantAdminBootstrap: {
          username: 'bootstrap-user',
          email: 'bootstrap-user@test.invalid',
        },
      })
    ).rejects.toThrow('upstream failed');
  });

  it('bootstraps a tenant admin and writes password reset actions', async () => {
    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      realmMode: 'new',
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
        instanceId: ['bb-guben'],
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
      realmMode: 'existing',
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
    expect(state.ensureRealm).not.toHaveBeenCalled();
    expect(state.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSecret: undefined,
        rotateClientSecret: undefined,
      })
    );

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
        tenantAdminInstanceIdMatches: true,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      })
    );
  });

  it('reuses an existing user found by email when user creation conflicts', async () => {
    state.createUser.mockRejectedValueOnce(
      new KeycloakAdminRequestError({
        message: 'Keycloak create_user failed: User exists with same email',
        statusCode: 409,
        code: 'user_exists',
        retryable: false,
      })
    );
    state.findUserByEmail.mockResolvedValue({
      id: 'email-user',
      username: 'legacy-user',
      email: 'bootstrap-user@test.invalid',
      enabled: true,
      attributes: {
        locale: ['de'],
      },
    });

    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      realmMode: 'existing',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      tenantAdminBootstrap: {
        username: 'bootstrap-user',
        email: 'bootstrap-user@test.invalid',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      tenantAdminTemporaryPassword: 'test-temp-password',
    });

    expect(state.findUserByEmail).toHaveBeenCalledWith('bootstrap-user@test.invalid');
    expect(state.updateUser).toHaveBeenCalledWith(
      'email-user',
      expect.objectContaining({
        username: 'bootstrap-user',
        email: 'bootstrap-user@test.invalid',
        firstName: 'Tenant',
        lastName: 'Admin',
        attributes: {
          locale: ['de'],
          instanceId: ['bb-guben'],
        },
      })
    );
    expect(state.syncRoles).toHaveBeenCalledWith('email-user', ['system_admin']);
    expect(state.setUserPassword).toHaveBeenCalledWith('email-user', 'test-temp-password', true);
    expect(state.setUserRequiredActions).toHaveBeenCalledWith('email-user', ['UPDATE_PASSWORD']);
  });

  it('only rotates the client secret when the intent requests it explicitly', async () => {
    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      realmMode: 'existing',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      authClientSecret: 'registry-secret',
    });

    expect(state.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSecret: 'registry-secret',
        rotateClientSecret: undefined,
      })
    );

    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      realmMode: 'existing',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      authClientSecret: 'registry-secret',
      rotateClientSecret: true,
    });

    expect(state.ensureOidcClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clientSecret: 'registry-secret',
        rotateClientSecret: true,
      })
    );
  });

  it('provisions login and tenant admin clients with separate secrets during dual-client bootstrap', async () => {
    state.getOidcClientSecretValue.mockResolvedValueOnce('generated-login-secret').mockResolvedValueOnce('generated-admin-secret');

    await provisionInstanceAuthArtifacts({
      instanceId: 'bb-guben',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      tenantAdminClient: {
        clientId: 'sva-studio-admin',
      },
    });

    expect(state.ensureOidcClient).toHaveBeenCalledTimes(2);
    expect(state.ensureOidcClient).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        clientId: 'sva-studio',
        clientSecret: undefined,
        rotateClientSecret: undefined,
      })
    );
    expect(state.ensureOidcClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        clientId: 'sva-studio-admin',
        redirectUris: [],
        postLogoutRedirectUris: [],
        webOrigins: [],
        rootUrl: 'https://bb-guben.studio.smart-village.app',
        serviceAccountsEnabled: true,
        standardFlowEnabled: false,
        directAccessGrantsEnabled: false,
        clientSecret: undefined,
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
        tenantAdminInstanceIdMatches: false,
        clientSecretConfigured: false,
        tenantClientSecretReadable: false,
        clientSecretAligned: false,
        runtimeSecretSource: 'global',
      })
    );
  });

  it('marks tenant admin status as not aligned when the instanceId attribute differs', async () => {
    state.findUserByUsername.mockResolvedValue({
      id: 'existing-user',
      attributes: {
        instanceId: ['anderes-instance-id'],
      },
    });

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
        tenantAdminExists: true,
        tenantAdminInstanceIdMatches: false,
      })
    );
  });

  it('builds a ready preflight from successful state reads', async () => {
    state.getRealm.mockResolvedValue({ realm: 'bb-guben' });

    await expect(
      getInstanceKeycloakPreflight({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        authClientSecret: 'registry-secret',
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        overallStatus: expect.stringMatching(/ready|warning|blocked/),
        checks: expect.any(Array),
      })
    );
  });

  it('builds a plan with state and preflight when both reads succeed', async () => {
    state.getRealm.mockResolvedValue({ realm: 'bb-guben' });

    await expect(
      getInstanceKeycloakPlan({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        authClientSecret: 'registry-secret',
        tenantAdminBootstrap: { username: 'bootstrap-user' },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        overallStatus: expect.stringMatching(/ready|warning|blocked/),
        steps: expect.any(Array),
      })
    );
  });

  it('fails existing-realm provisioning when the target realm does not exist', async () => {
    state.getRealm.mockResolvedValue(null);

    await expect(
      provisionInstanceAuthArtifacts({
        instanceId: 'bb-guben',
        primaryHostname: 'bb-guben.studio.smart-village.app',
        realmMode: 'existing',
        authRealm: 'bb-guben',
        authClientId: 'sva-studio',
      })
    ).rejects.toThrow('Keycloak realm bb-guben does not exist');

    expect(state.ensureRealm).not.toHaveBeenCalled();
    expect(state.ensureOidcClient).not.toHaveBeenCalled();
  });
});

describe('provisioning-auth preflight and plan', () => {
  beforeEach(() => {
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
  });

  it('returns blocked preflight with keycloak access check when state read fails', async () => {
    state.getRealm.mockRejectedValueOnce(
      new KeycloakAdminRequestError({
        message: 'realm read failed',
        statusCode: 503,
        code: 'service_unavailable',
        retryable: true,
      })
    );

    const preflight = await getInstanceKeycloakPreflight({
      instanceId: 'de-test',
      primaryHostname: 'de-test.studio.smart-village.app',
      realmMode: 'existing',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
      authClientSecret: undefined,
      tenantAdminBootstrap: undefined,
    });

    expect(preflight.overallStatus).toBe('blocked');
    expect(preflight.checks.find((check) => check.checkKey === 'keycloak_admin_access')?.status).toBe('blocked');
    expect(preflight.checks.find((check) => check.checkKey === 'keycloak_admin_access')?.details).toEqual(
      expect.objectContaining({ error: expect.stringContaining('HTTP 503') })
    );
  });

  it('returns fallback plan when read state fails but preflight is still available', async () => {
    state.getRealm.mockRejectedValue(
      new KeycloakAdminRequestError({
        message: 'realm read failed',
        statusCode: 503,
        code: 'service_unavailable',
        retryable: true,
      })
    );

    const plan = await getInstanceKeycloakPlan({
      instanceId: 'de-test',
      primaryHostname: 'de-test.studio.smart-village.app',
      realmMode: 'new',
      authRealm: 'de-test',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
      authClientSecret: undefined,
      tenantAdminBootstrap: undefined,
    });

    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.overallStatus).toBe('blocked');
    expect(plan.steps.every((step) => step.status === 'blocked' || step.status === 'ready')).toBe(true);
  });
});
