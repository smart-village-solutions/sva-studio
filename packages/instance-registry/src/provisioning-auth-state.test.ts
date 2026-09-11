import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ error: loggerErrorMock }),
}));

import {
  createKeycloakProvisioningAdapters,
  createKeycloakProvisioningClientFactory,
  createProvisionInstanceAuthArtifacts,
  createReadKeycloakClientSecrets,
  createReadKeycloakState,
  type KeycloakProvisioningClient,
} from './provisioning-auth-state.js';

const ssfClientRequirement = {
  contractVersion: '1.0',
  pluginId: 'ssf',
  clientId: 'ssf',
  audience: 'ssf',
  enabled: false,
} as const;

beforeEach(() => {
  loggerErrorMock.mockReset();
});

const createClientWithAlignedSsf = () =>
  createClient({
    getOidcClientByClientId: vi.fn(async (clientId: string) =>
      clientId === 'ssf'
        ? {
            id: 'ssf-id',
            clientId: 'ssf',
            enabled: false,
            protocol: 'openid-connect',
            publicClient: false,
            rootUrl: '',
            redirectUris: [],
            webOrigins: [],
            standardFlowEnabled: false,
            implicitFlowEnabled: false,
            directAccessGrantsEnabled: false,
            serviceAccountsEnabled: false,
            attributes: { 'post.logout.redirect.uris': '' },
          }
        : {
            id: `${clientId}-id`,
            clientId,
            redirectUris: ['https://demo.example.org/*'],
            attributes: { 'post.logout.redirect.uris': 'https://demo.example.org/*' },
            webOrigins: ['https://demo.example.org'],
            rootUrl: 'https://demo.example.org',
          }
    ),
    listClientProtocolMappers: vi.fn(async (clientId: string) =>
      clientId === 'ssf'
        ? [
            {
              name: 'studio-ssf-audience',
              protocol: 'openid-connect',
              protocolMapper: 'oidc-audience-mapper',
              config: {
                'included.client.audience': 'ssf',
                'id.token.claim': 'false',
                'access.token.claim': 'true',
                'lightweight.claim': 'false',
                'introspection.token.claim': 'true',
              },
            },
          ]
        : [{ name: 'instanceId' }]
    ),
  });

const createClient = (
  overrides?: Partial<KeycloakProvisioningClient>
): KeycloakProvisioningClient => ({
  ensureRealm: vi.fn(async () => true),
  deleteRealm: vi.fn(async () => undefined),
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
  ensureTenantAdminServiceAccess: vi.fn(async () => undefined),
  listClientProtocolMappers: vi.fn(async () => [{ name: 'instanceId' }]),
  ensureUserAttributeProtocolMapper: vi.fn(async () => undefined),
  ensureAudienceProtocolMapper: vi.fn(async () => undefined),
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

  it('returns an empty auth state when the realm does not exist', async () => {
    const client = createClient({
      getRealm: vi.fn(async () => null),
    });
    const readState = createReadKeycloakState(() => client);

    const state = await readState({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
    });

    expect(state.realm).toBeNull();
    expect(state.clientRepresentation).toBeNull();
    expect(state.protocolMappers).toEqual([]);
    expect(state.keycloakClientSecret).toBeNull();
    expect(client.getOidcClientByClientId).not.toHaveBeenCalled();
  });

  it('reads rotated secrets without inspecting plugin clients or mappers', async () => {
    const client = createClient({
      getOidcClientSecretValue: vi.fn(async (clientId: string) => `${clientId}-secret`),
    });
    const readSecrets = createReadKeycloakClientSecrets(() => client);

    await expect(
      readSecrets({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminClient: { clientId: 'tenant-admin' },
        pluginOidcClients: [ssfClientRequirement],
      })
    ).resolves.toEqual({
      keycloakClientSecret: 'sva-studio-secret',
      tenantAdminClientSecret: 'tenant-admin-secret',
    });

    expect(client.getOidcClientSecretValue).toHaveBeenCalledTimes(2);
    expect(client.getOidcClientByClientId).not.toHaveBeenCalled();
    expect(client.listClientProtocolMappers).not.toHaveBeenCalled();
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
    expect(client.deleteRealm).not.toHaveBeenCalled();
    expect(client.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'sva-studio' })
    );
    expect(client.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'tenant-admin' })
    );
    expect(client.ensureTenantAdminServiceAccess).toHaveBeenCalledWith('tenant-admin');
    expect(client.ensureUserAttributeProtocolMapper).not.toHaveBeenCalled();
    expect(client.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'tenant-admin',
      })
    );
    expect(client.ensureRealmRole).toHaveBeenCalledWith('system_admin', 'demo');
    expect(client.ensureRealmRole).not.toHaveBeenCalledWith('instance_registry_admin');
    expect(client.setUserPassword).toHaveBeenCalledWith('user-1', 'tmp-password', true);
  });

  it('ensures the protected tenant role without a tenant admin bootstrap', async () => {
    const client = createClient();
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await provision({
      instanceId: 'tenant-havelland',
      primaryHostname: 'havelland.example.org',
      realmMode: 'existing',
      authRealm: 'havelland',
      authClientId: 'sva-studio',
    });

    expect(client.ensureRealmRole).toHaveBeenCalledWith('system_admin', 'tenant-havelland');
    expect(client.findUserByUsername).not.toHaveBeenCalled();
  });

  it('provisions the disabled SSF client independently for two tenant realms', async () => {
    const clients = new Map([
      ['tenant-a', createClientWithAlignedSsf()],
      ['tenant-b', createClientWithAlignedSsf()],
    ]);
    const provision = createProvisionInstanceAuthArtifacts((realm) => {
      const client = realm ? clients.get(realm) : undefined;
      if (!client) throw new Error('unexpected_realm');
      return client;
    });

    for (const authRealm of clients.keys()) {
      await provision({
        instanceId: authRealm,
        primaryHostname: `${authRealm}.example.org`,
        realmMode: 'existing',
        authRealm,
        authClientId: 'sva-studio',
        pluginOidcClients: [ssfClientRequirement],
      });
    }

    for (const client of clients.values()) {
      expect(client.ensureOidcClient).toHaveBeenCalledWith({
        clientId: 'ssf',
        redirectUris: [],
        postLogoutRedirectUris: [],
        webOrigins: [],
        rootUrl: '',
        enabled: false,
        standardFlowEnabled: false,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: false,
        uriPolicy: 'replace',
      });
      expect(client.ensureAudienceProtocolMapper).toHaveBeenCalledWith({
        clientId: 'ssf',
        name: 'studio-ssf-audience',
        audience: 'ssf',
      });
    }
  });

  it('rejects plugin OIDC declarations outside the versioned allowlist', async () => {
    const client = createClient();
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        pluginOidcClients: [
          {
            ...ssfClientRequirement,
            redirectUris: ['https://provider.example/callback'],
          } as typeof ssfClientRequirement,
        ],
      })
    ).rejects.toThrow('plugin_oidc_client_requirement_invalid');

    expect(client.ensureOidcClient).not.toHaveBeenCalled();
  });

  it('fails closed when the SSF client read-back does not match the declared state', async () => {
    const client = createClient({
      getOidcClientByClientId: vi.fn(async (clientId: string) => ({
        id: `${clientId}-id`,
        clientId,
        enabled: clientId === 'ssf',
      })),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        pluginOidcClients: [ssfClientRequirement],
      })
    ).rejects.toThrow('plugin_oidc_client_readback_failed:ssf:ssf');

    expect(client.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'ssf', enabled: false, uriPolicy: 'replace' })
    );
    expect(client.ensureAudienceProtocolMapper).toHaveBeenCalledOnce();
    expect(client.deleteRealm).not.toHaveBeenCalled();
  });

  it('disables implicit flow and rejects read-back while it remains enabled', async () => {
    const client = createClientWithAlignedSsf();
    vi.mocked(client.getOidcClientByClientId).mockResolvedValue({
      id: 'ssf-id',
      clientId: 'ssf',
      enabled: false,
      protocol: 'openid-connect',
      publicClient: false,
      rootUrl: '',
      redirectUris: [],
      webOrigins: [],
      standardFlowEnabled: false,
      implicitFlowEnabled: true,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      attributes: { 'post.logout.redirect.uris': '' },
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        pluginOidcClients: [ssfClientRequirement],
      })
    ).rejects.toThrow('plugin_oidc_client_readback_failed:ssf:ssf');

    expect(client.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'ssf', implicitFlowEnabled: false })
    );
    expect(client.deleteRealm).not.toHaveBeenCalled();
  });

  it('rejects read-back when the plugin client is public or not OIDC', async () => {
    const client = createClientWithAlignedSsf();
    vi.mocked(client.getOidcClientByClientId).mockResolvedValue({
      id: 'ssf-id',
      clientId: 'ssf',
      enabled: false,
      protocol: 'saml',
      publicClient: true,
      rootUrl: '',
      redirectUris: [],
      webOrigins: [],
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      attributes: { 'post.logout.redirect.uris': '' },
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        pluginOidcClients: [ssfClientRequirement],
      })
    ).rejects.toThrow('plugin_oidc_client_readback_failed:ssf:ssf');

    expect(client.deleteRealm).not.toHaveBeenCalled();
  });

  it('reconciles plugin clients before rotating the Studio client secret', async () => {
    const client = createClient({
      getOidcClientByClientId: vi.fn(async (clientId: string) => ({
        id: `${clientId}-id`,
        clientId,
        enabled: true,
      })),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecret: 'current-secret',
        rotateClientSecret: true,
        pluginOidcClients: [ssfClientRequirement],
      })
    ).rejects.toThrow('plugin_oidc_client_readback_failed:ssf:ssf');

    expect(client.ensureOidcClient).toHaveBeenCalledOnce();
    expect(client.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'ssf' })
    );
  });

  it('does not create secret-bearing clients when plugin reconciliation fails for a new realm', async () => {
    const client = createClient({
      getOidcClientByClientId: vi.fn(async (clientId: string) => ({
        id: `${clientId}-id`,
        clientId,
        enabled: clientId === 'ssf',
      })),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        tenantAdminClient: { clientId: 'tenant-admin' },
        pluginOidcClients: [ssfClientRequirement],
      })
    ).rejects.toThrow('plugin_oidc_client_readback_failed:ssf:ssf');

    expect(client.ensureRealm).toHaveBeenCalledOnce();
    expect(client.ensureOidcClient).toHaveBeenCalledOnce();
    expect(client.ensureOidcClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'ssf' })
    );
    expect(client.ensureTenantAdminServiceAccess).not.toHaveBeenCalled();
    expect(client.deleteRealm).toHaveBeenCalledOnce();
  });

  it('requires manual cleanup when compensating a newly created realm fails', async () => {
    const cleanupError = Object.assign(new Error('keycloak_delete_failed'), {
      code: 'http_403',
      statusCode: 403,
    });
    const client = createClient({
      deleteRealm: vi.fn(async () => {
        throw cleanupError;
      }),
      getOidcClientByClientId: vi.fn(async (clientId: string) => ({
        id: `${clientId}-id`,
        clientId,
        enabled: clientId === 'ssf',
      })),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    const result = provision({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      pluginOidcClients: [ssfClientRequirement],
    });

    await expect(result).rejects.toThrow(
      'plugin_oidc_client_reconciliation_failed_realm_cleanup_failed_requires_manual_action'
    );
    await expect(result).rejects.toMatchObject({ cause: cleanupError });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'realm_cleanup_failed',
      expect.objectContaining({
        reconciliation_error_type: 'Error',
        reconciliation_error_message: 'plugin_oidc_client_readback_failed:ssf:ssf',
        error_type: 'Error',
        error_code: 'http_403',
        http_status: 403,
      })
    );

    expect(client.ensureOidcClient).toHaveBeenCalledOnce();
    expect(client.deleteRealm).toHaveBeenCalledOnce();
  });

  it('rejects existing-realm provisioning when the target realm is missing', async () => {
    const client = createClient({
      getRealm: vi.fn(async () => null),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      })
    ).rejects.toThrow('Keycloak realm demo does not exist');

    expect(client.ensureRealm).not.toHaveBeenCalled();
  });

  it('updates an existing tenant admin and falls back to a synthetic email when none is provided', async () => {
    const client = createClient({
      findUserByUsername: vi.fn(async () => ({
        id: 'user-1',
        enabled: false,
      })),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await provision({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      tenantAdminBootstrap: {
        username: 'tenant-admin',
      },
      tenantAdminTemporaryPassword: 'tmp-password',
    });

    expect(client.updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        username: 'tenant-admin',
        email: 'tenant-admin@tenant.invalid',
        enabled: false,
      })
    );
    expect(client.syncRoles).toHaveBeenCalledWith('user-1', ['system_admin']);
  });

  it('skips client reconciliation for tenant-admin-only reset flows', async () => {
    const client = createClient();
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await provision({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      tenantAdminClient: {
        clientId: 'tenant-admin',
      },
      tenantAdminClientSecret: 'tenant-secret',
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant-admin@example.org',
      },
      tenantAdminTemporaryPassword: 'tmp-password',
      reconcileAuthClient: false,
      reconcileTenantAdminClient: false,
    });

    expect(client.ensureOidcClient).not.toHaveBeenCalled();
    expect(client.ensureTenantAdminServiceAccess).not.toHaveBeenCalled();
    expect(client.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'tenant-admin',
      })
    );
    expect(client.setUserPassword).toHaveBeenCalledWith('user-1', 'tmp-password', true);
  });

  it('does not adopt an existing user solely because the email matches', async () => {
    const client = createClient({
      findUserByUsername: vi.fn(async () => null),
      findUserByEmail: vi.fn(async () => ({
        id: 'root-user',
        enabled: true,
      })),
      createUser: vi.fn(async () => {
        throw Object.assign(new Error('conflict'), { statusCode: 409 });
      }),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await expect(
      provision({
        instanceId: 'demo',
        primaryHostname: 'demo.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        tenantAdminBootstrap: {
          username: 'tenant-admin',
          email: 'tenant-admin@example.org',
        },
      })
    ).rejects.toThrow('conflict');

    expect(client.findUserByEmail).not.toHaveBeenCalled();
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it('recovers an idempotent create conflict only by re-reading the configured username', async () => {
    const findUserByUsername = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'tenant-user', enabled: true });
    const client = createClient({
      findUserByUsername,
      createUser: vi.fn(async () => {
        throw Object.assign(new Error('conflict'), { statusCode: 409 });
      }),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await provision({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant-admin@example.org',
      },
    });

    expect(findUserByUsername).toHaveBeenCalledTimes(2);
    expect(client.findUserByEmail).not.toHaveBeenCalled();
    expect(client.updateUser).toHaveBeenCalledWith(
      'tenant-user',
      expect.objectContaining({ username: 'tenant-admin' })
    );
  });

  it('preserves the raced username identity email when no bootstrap email is configured', async () => {
    const client = createClient({
      findUserByUsername: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'tenant-user',
          email: 'preserved@example.org',
          enabled: true,
        }),
      createUser: vi.fn(async () => {
        throw Object.assign(new Error('conflict'), { statusCode: 409 });
      }),
    });
    const provision = createProvisionInstanceAuthArtifacts(() => client);

    await provision({
      instanceId: 'demo',
      primaryHostname: 'demo.example.org',
      realmMode: 'new',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      tenantAdminBootstrap: { username: 'tenant-admin' },
    });

    expect(client.updateUser).toHaveBeenCalledWith(
      'tenant-user',
      expect.objectContaining({ email: 'preserved@example.org' })
    );
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
