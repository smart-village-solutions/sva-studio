import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  getKeycloakAdminClientSecret: vi.fn(),
  getKeycloakProvisionerClientSecret: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('../runtime-secrets.js', () => ({
  getKeycloakAdminClientSecret: state.getKeycloakAdminClientSecret,
  getKeycloakProvisionerClientSecret: state.getKeycloakProvisionerClientSecret,
}));

const createJsonResponse = (status: number, payload: unknown, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

const createClient = async (fetchImpl: ReturnType<typeof vi.fn>, options: Record<string, unknown> = {}) => {
  const { KeycloakAdminClient } = await import('./core.js');

  return new KeycloakAdminClient({
    baseUrl: 'https://keycloak.example/',
    realm: 'demo',
    clientId: 'studio',
    clientSecret: 'secret',
    fetchImpl,
    now: () => 0,
    sleep: async () => undefined,
    ...options,
  });
};

describe('Keycloak admin client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.getKeycloakAdminClientSecret.mockReturnValue(null);
    state.getKeycloakProvisionerClientSecret.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates users from the location header', async () => {
    const { KeycloakAdminClient } = await import('./core.js');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: {
            location: 'https://keycloak.example/admin/realms/demo/users/user-123',
          },
        })
      );

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example/',
      realm: 'demo',
      clientId: 'studio',
      clientSecret: 'secret',
      fetchImpl,
      now: () => 0,
      sleep: async () => undefined,
    });

    await expect(
      client.createUser({
        email: 'test@example.com',
        firstName: 'Tina',
        lastName: 'Tester',
      })
    ).resolves.toEqual({ externalId: 'user-123' });
  });

  it('rejects user creation without a location header', async () => {
    const { KeycloakAdminClient, KeycloakAdminRequestError } = await import('./core.js');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example',
      realm: 'demo',
      clientId: 'studio',
      clientSecret: 'secret',
      fetchImpl,
      now: () => 0,
      sleep: async () => undefined,
    });

    await expect(
      client.createUser({
        email: 'test@example.com',
      })
    ).rejects.toBeInstanceOf(KeycloakAdminRequestError);
  });

  it('retries retryable request failures and then succeeds', async () => {
    const { KeycloakAdminClient } = await import('./core.js');
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(503, { error: 'temporarily_unavailable' }))
      .mockResolvedValueOnce(createJsonResponse(200, []));

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example',
      realm: 'demo',
      clientId: 'studio',
      clientSecret: 'secret',
      fetchImpl,
      maxRetries: 1,
      now: () => 0,
      sleep,
    });

    await expect(client.listRoles()).resolves.toEqual([]);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Retrying Keycloak request',
      expect.objectContaining({
        operation: 'list_roles',
        reason: 'http_503:503',
      })
    );
  });

  it('opens the circuit breaker after configured failures and blocks subsequent reads', async () => {
    const { KeycloakAdminClient, KeycloakAdminUnavailableError } = await import('./core.js');
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(503, { error: 'temporarily_unavailable' }));

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example',
      realm: 'demo',
      clientId: 'studio',
      clientSecret: 'secret',
      fetchImpl,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerOpenMs: 30_000,
      now: () => now,
      sleep: async () => undefined,
    });

    await expect(client.listRoles()).rejects.toThrow('Keycloak list_roles failed');
    await expect(client.listUsers()).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);

    now = 40_000;
    fetchImpl.mockResolvedValueOnce(createJsonResponse(200, []));
    await expect(client.listRoles()).resolves.toEqual([]);
  });

  it('reads env-based configs and prefers runtime secrets when available', async () => {
    state.getKeycloakAdminClientSecret.mockReturnValue('secret-from-runtime');
    state.getKeycloakProvisionerClientSecret.mockReturnValue('provisioner-from-runtime');
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://keycloak.example');
    vi.stubEnv('KEYCLOAK_ADMIN_REALM', 'master');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', 'studio');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', 'secret-from-env');
    vi.stubEnv('KEYCLOAK_PROVISIONER_CLIENT_ID', 'tenant-provisioner');

    const { getKeycloakAdminClientConfigFromEnv, getKeycloakProvisionerClientConfigFromEnv } = await import(
      './core.js'
    );

    expect(getKeycloakAdminClientConfigFromEnv()).toMatchObject({
      baseUrl: 'https://keycloak.example',
      realm: 'master',
      clientId: 'studio',
      clientSecret: 'secret-from-runtime',
    });
    expect(getKeycloakProvisionerClientConfigFromEnv()).toMatchObject({
      baseUrl: 'https://keycloak.example',
      realm: 'master',
      clientId: 'tenant-provisioner',
      clientSecret: 'provisioner-from-runtime',
    });
  });

  it('synchronizes managed realm roles while preserving built-ins and unmanaged roles', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'current-a', name: 'role-a' },
          { id: 'offline', name: 'offline_access' },
          { id: 'foreign', name: 'foreign-role' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'role-a',
            name: 'role-a',
            attributes: { managed_by: ['studio'], instance_id: ['demo'] },
          },
          {
            id: 'role-b',
            name: 'role-b',
            attributes: { managed_by: ['studio'], instance_id: ['demo'] },
          },
          {
            id: 'foreign',
            name: 'foreign-role',
            attributes: { managed_by: ['other'] },
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = await createClient(fetchImpl);

    await client.syncRoles('user-1', ['role-b']);

    const addCall = fetchImpl.mock.calls[3];
    const removeCall = fetchImpl.mock.calls[4];
    expect(String(addCall?.[0])).toContain('/users/user-1/role-mappings/realm');
    expect(JSON.parse(String(addCall?.[1]?.body))).toEqual([
      expect.objectContaining({
        id: 'role-b',
        name: 'role-b',
      }),
    ]);
    expect(JSON.parse(String(removeCall?.[1]?.body))).toEqual([
      expect.objectContaining({
        id: 'current-a',
        name: 'role-a',
      }),
    ]);
  });

  it('rejects assigning unknown realm roles and skips empty removals', async () => {
    type KeycloakAdminRequestError = import('./core.js').KeycloakAdminRequestError;
    const assignFetch = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'role-a', name: 'role-a' }]));

    const assignClient = await createClient(assignFetch);

    await expect(assignClient.assignRealmRoles('user-1', ['missing-role'])).rejects.toMatchObject<KeycloakAdminRequestError>({
      code: 'unknown_role',
      statusCode: 400,
    });

    const removeFetch = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'role-a', name: 'role-a' }]));
    const removeClient = await createClient(removeFetch);

    await expect(removeClient.removeRealmRoles('user-1', ['missing-role'])).resolves.toBeUndefined();
    expect(removeFetch).toHaveBeenCalledTimes(2);
  });

  it('counts roles from numeric and object responses and maps missing role lookups to null', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, 12))
      .mockResolvedValueOnce(createJsonResponse(200, { count: 3 }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }));

    const client = await createClient(fetchImpl);

    await expect(client.countRoles({ search: 'editor' })).resolves.toBe(12);
    await expect(client.countRoles()).resolves.toBe(3);
    await expect(client.getRoleByName('missing')).resolves.toBeNull();
  });

  it('updates existing studio-managed roles after a create conflict', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(409, { error: 'exists' }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'editor',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['demo'],
            role_key: ['editor'],
            display_name: ['Editor'],
          },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'editor',
          description: 'Updated',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['demo'],
            role_key: ['editor'],
            display_name: ['Editor'],
          },
        })
      );

    const client = await createClient(fetchImpl);

    await expect(
      client.createRole({
        externalName: 'editor',
        description: 'Updated',
        attributes: {
          managedBy: 'studio',
          instanceId: 'demo',
          roleKey: 'editor',
          displayName: 'Editor',
        },
      })
    ).resolves.toMatchObject({
      id: 'role-1',
      externalName: 'editor',
      description: 'Updated',
    });
  });

  it('fails updateRole when post-update lookup no longer finds the role', async () => {
    type KeycloakAdminRequestError = import('./core.js').KeycloakAdminRequestError;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }));

    const client = await createClient(fetchImpl);

    await expect(
      client.updateRole('editor', {
        description: 'Updated',
        attributes: {
          managedBy: 'studio',
          instanceId: 'demo',
          roleKey: 'editor',
          displayName: 'Editor',
        },
      })
    ).rejects.toMatchObject<KeycloakAdminRequestError>({
      code: 'role_lookup_failed',
      statusCode: 502,
    });
  });

  it('creates realms idempotently and logs success for the first creation', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(409, { error: 'exists' }));

    const client = await createClient(fetchImpl);

    await expect(client.ensureRealm({ displayName: 'Demo Realm' })).resolves.toBeUndefined();
    await expect(client.ensureRealm({ displayName: 'Demo Realm' })).resolves.toBeUndefined();
    expect(state.logger.info).toHaveBeenCalledWith(
      'create_realm',
      expect.objectContaining({ operation: 'create_realm', realm: 'demo' })
    );
  });

  it('creates OIDC clients, rotates secrets and updates changed clients', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'client-1', clientId: 'web-app' }]))
      .mockResolvedValueOnce(createJsonResponse(200, { value: 'old-secret' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'client-1',
            clientId: 'web-app',
            rootUrl: 'https://old.example',
            redirectUris: ['https://old.example/callback'],
            webOrigins: ['https://old.example'],
            attributes: { 'post.logout.redirect.uris': 'https://old.example/logout' },
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, { value: 'old-secret' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://new.example/callback'],
      postLogoutRedirectUris: ['https://new.example/logout'],
      webOrigins: ['https://new.example'],
      rootUrl: 'https://new.example',
      clientSecret: 'new-secret',
      rotateClientSecret: true,
    });
    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://new.example/callback'],
      postLogoutRedirectUris: ['https://new.example/logout'],
      webOrigins: ['https://new.example'],
      rootUrl: 'https://new.example',
      clientSecret: 'new-secret',
      rotateClientSecret: true,
    });

    const createCall = fetchImpl.mock.calls[2];
    expect(String(createCall?.[0])).toContain('/clients');

    const updateCall = fetchImpl.mock.calls[7];
    expect(String(updateCall?.[0])).toContain('/clients/client-1');

    const rotateCall = fetchImpl.mock.calls[5];
    expect(String(rotateCall?.[0])).toContain('/clients/client-1/client-secret');
  });

  it('creates and updates protocol mappers only when configuration changed', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'client-1', clientId: 'web-app' }]))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'client-1', clientId: 'web-app' }]))
      .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'client-1', clientId: 'web-app' }]))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'mapper-1',
            name: 'instance-id',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-usermodel-attribute-mapper',
            config: {
              'user.attribute': 'old-attr',
              'claim.name': 'instanceId',
              'jsonType.label': 'String',
              'id.token.claim': 'true',
              'access.token.claim': 'true',
              'userinfo.token.claim': 'true',
            },
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = await createClient(fetchImpl);

    await client.ensureUserAttributeProtocolMapper({
      clientId: 'web-app',
      name: 'instance-id',
      userAttribute: 'instanceId',
      claimName: 'instanceId',
    });
    await client.ensureUserAttributeProtocolMapper({
      clientId: 'web-app',
      name: 'instance-id',
      userAttribute: 'tenantId',
      claimName: 'instanceId',
    });

    expect(String(fetchImpl.mock.calls[3]?.[0])).toContain('/protocol-mappers/models');
    expect(String(fetchImpl.mock.calls[7]?.[0])).toContain('/protocol-mappers/models/mapper-1');
  });

  it('finds users by exact username and case-insensitive email', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'user-1', username: 'alice', email: 'Alice@example.com' },
          { id: 'user-2', username: 'bob', email: 'bob@example.com' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'user-1', username: 'alice', email: 'Alice@example.com' },
          { id: 'user-2', username: 'bob', email: 'bob@example.com' },
        ])
      );

    const client = await createClient(fetchImpl);

    await expect(client.findUserByUsername('alice')).resolves.toMatchObject({ id: 'user-1' });
    await expect(client.findUserByEmail('alice@EXAMPLE.com')).resolves.toMatchObject({ id: 'user-1' });
  });

  it('filters user attributes and returns null for missing client secrets or realms', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'user-1',
          attributes: {
            instanceId: ['demo'],
            locale: ['de'],
          },
        })
      )
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }))
      .mockResolvedValueOnce(createJsonResponse(200, []));

    const client = await createClient(fetchImpl);

    await expect(client.getUserAttributes('user-1', ['locale'])).resolves.toEqual({ locale: ['de'] });
    await expect(client.getRealm()).resolves.toBeNull();
    await expect(client.getOidcClientSecretValue('missing-client')).resolves.toBeNull();
  });

  it('skips realm role creation and protocol mapper reads when entities already do not require changes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'editor',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['demo'],
          },
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, []));

    const client = await createClient(fetchImpl);

    await expect(client.ensureRealmRole('editor')).resolves.toBeUndefined();
    await expect(client.listClientProtocolMappers('missing-client')).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('sets required actions and logs password reset failures with write protection', async () => {
    const { KeycloakAdminRequestError, KeycloakAdminUnavailableError } = await import('./core.js');
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(500, { error: 'boom' }));

    const client = await createClient(fetchImpl, {
      maxRetries: 0,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerOpenMs: 30_000,
      now: () => now,
    });

    await expect(client.setUserRequiredActions('user-1', ['UPDATE_PASSWORD'])).resolves.toBeUndefined();
    await expect(client.setUserPassword('user-1', 'secret', false)).rejects.toBeInstanceOf(KeycloakAdminRequestError);
    expect(state.logger.error).toHaveBeenCalledWith(
      'reset_user_password_failed',
      expect.objectContaining({ operation: 'reset_user_password' })
    );

    await expect(client.logoutUser('user-1')).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);
    now = 40_000;
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(client.logoutUser('user-1')).resolves.toBeUndefined();
  });
});
