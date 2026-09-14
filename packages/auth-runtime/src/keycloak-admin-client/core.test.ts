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

const createJsonResponse = (
  status: number,
  payload: unknown,
  headers?: Record<string, string>
): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

const createClient = async (
  fetchImpl: ReturnType<typeof vi.fn>,
  options: Record<string, unknown> = {}
) => {
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

  it('loads direct and effective realm roles from separate Keycloak projections', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'role-direct', name: 'news_editor', composite: false }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-direct', name: 'news_editor', composite: false },
          { id: 'role-inherited', name: 'event_editor', composite: false },
        ])
      );
    const client = await createClient(fetchImpl);

    await expect(client.listUserRealmRoleAssignments('user-1')).resolves.toEqual({
      direct: [expect.objectContaining({ id: 'role-direct', externalName: 'news_editor' })],
      effective: [
        expect.objectContaining({ id: 'role-direct', externalName: 'news_editor' }),
        expect.objectContaining({ id: 'role-inherited', externalName: 'event_editor' }),
      ],
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://keycloak.example/admin/realms/demo/users/user-1/role-mappings/realm',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://keycloak.example/admin/realms/demo/users/user-1/role-mappings/realm/composite',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('sends execute-actions emails with optional redirect and client parameters', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = await createClient(fetchImpl);

    await expect(
      client.executeActionsEmail('user-123', {
        actions: ['UPDATE_PASSWORD'],
        clientId: 'sva-studio',
        redirectUri: 'https://tenant.example.test/',
        lifespan: 900,
      })
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://keycloak.example/admin/realms/demo/users/user-123/execute-actions-email?client_id=sva-studio&redirect_uri=https%3A%2F%2Ftenant.example.test%2F&lifespan=900',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(['UPDATE_PASSWORD']),
      })
    );
  });

  it('deletes a keycloak user by external id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = await createClient(fetchImpl);

    await expect(client.deleteUser('kc-user-1')).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://keycloak.example/admin/realms/demo/users/kc-user-1',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('preserves every structured Keycloak field error for profile update failures', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(400, {
          errors: [
            {
              field: 'firstName',
              errorMessage: 'error-user-attribute-read-only',
              params: ['firstName'],
            },
            {
              field: 'email',
              errorMessage: 'error-invalid-email',
              params: ['email'],
            },
          ],
        })
      );
    const client = await createClient(fetchImpl, { maxRetries: 0 });

    await expect(client.updateUser('kc-user-1', { firstName: 'Seed' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'http_400',
      retryable: false,
      message: expect.stringContaining('error-user-attribute-read-only'),
      fieldErrors: [
        { field: 'firstName', code: 'error-user-attribute-read-only' },
        { field: 'email', code: 'error-invalid-email' },
      ],
    });
  });

  it('surfaces keycloak delete-user failures', async () => {
    const { KeycloakAdminRequestError } = await import('./core.js');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(500, { error: 'boom' }));

    const client = await createClient(fetchImpl, { maxRetries: 0 });

    await expect(client.deleteUser('kc-user-1')).rejects.toBeInstanceOf(KeycloakAdminRequestError);
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

    await expect(client.listRoles({ briefRepresentation: false })).resolves.toEqual([]);
    expect(fetchImpl.mock.calls[1]?.[0]).toContain('briefRepresentation=false');
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

  it('does not open the circuit breaker for deterministic client rejections', async () => {
    const { KeycloakAdminClient, KeycloakAdminRequestError } = await import('./core.js');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(400, {
          errors: [
            {
              field: 'firstName',
              errorMessage: 'error-user-attribute-read-only',
            },
          ],
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, []));

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example',
      realm: 'demo',
      clientId: 'studio',
      clientSecret: 'secret',
      fetchImpl,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerOpenMs: 30_000,
      now: () => 0,
      sleep: async () => undefined,
    });

    await expect(client.updateUser('kc-user-1', { firstName: 'Seed' })).rejects.toBeInstanceOf(
      KeycloakAdminRequestError
    );
    await expect(client.listRoles()).resolves.toEqual([]);
  });

  it('opens the circuit breaker for unclassified provider failures', async () => {
    const { KeycloakAdminClient, KeycloakAdminUnavailableError } = await import('./core.js');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockRejectedValueOnce(new TypeError('network failure'));

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example',
      realm: 'demo',
      clientId: 'studio',
      clientSecret: 'secret',
      fetchImpl,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerOpenMs: 30_000,
      now: () => 0,
      sleep: async () => undefined,
    });

    await expect(client.listRoles()).rejects.toThrow('network failure');
    await expect(client.listUsers()).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);
  });

  it('reads env-based configs and prefers runtime secrets when available', async () => {
    state.getKeycloakAdminClientSecret.mockReturnValue('secret-from-runtime');
    state.getKeycloakProvisionerClientSecret.mockReturnValue('provisioner-from-runtime');
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'local-keycloak');
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://keycloak.example');
    vi.stubEnv('KEYCLOAK_ADMIN_REALM', 'master');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', 'studio');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', 'secret-from-env');
    vi.stubEnv('KEYCLOAK_PROVISIONER_BASE_URL', 'https://keycloak.example');
    vi.stubEnv('KEYCLOAK_PROVISIONER_REALM', 'master');
    vi.stubEnv('KEYCLOAK_PROVISIONER_CLIENT_ID', 'tenant-provisioner');
    vi.stubEnv('KEYCLOAK_PROVISIONER_CLIENT_SECRET', 'provisioner-secret-from-env');

    const { getKeycloakAdminClientConfigFromEnv, getKeycloakProvisionerClientConfigFromEnv } =
      await import('./core.js');

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

  it('fails closed for local-keycloak when provisioner env is missing', async () => {
    state.getKeycloakAdminClientSecret.mockReturnValue('secret-from-runtime');
    state.getKeycloakProvisionerClientSecret.mockReturnValue('provisioner-from-runtime');
    vi.stubEnv('SVA_RUNTIME_PROFILE', 'local-keycloak');
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://keycloak.example');
    vi.stubEnv('KEYCLOAK_ADMIN_REALM', 'svs-intern-studio-staging');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', 'sva-studio-iam-service');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', 'secret-from-env');

    const { getKeycloakProvisionerClientConfigFromEnv } = await import('./core.js');

    expect(() => getKeycloakProvisionerClientConfigFromEnv()).toThrow(
      'Missing required provisioner env for local-keycloak: KEYCLOAK_PROVISIONER_REALM'
    );
  });

  it('normalizes the admin base URL and rejects blank configuration', async () => {
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', '  https://keycloak.example  ');
    vi.stubEnv('KEYCLOAK_ADMIN_REALM', 'master');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', 'studio');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', 'secret-from-env');

    const { getKeycloakAdminClientConfigFromEnv } = await import('./core.js');

    expect(getKeycloakAdminClientConfigFromEnv().baseUrl).toBe('https://keycloak.example');

    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', '   ');
    expect(() => getKeycloakAdminClientConfigFromEnv()).toThrow(
      'Missing required env: KEYCLOAK_ADMIN_BASE_URL'
    );
  });

  it('builds tenant-admin config for the tenant realm without using platform credentials', async () => {
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', 'https://keycloak.example');
    vi.stubEnv('KEYCLOAK_ADMIN_REALM', 'platform');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_ID', 'platform-client');
    vi.stubEnv('KEYCLOAK_ADMIN_CLIENT_SECRET', 'platform-secret');

    const { getKeycloakTenantAdminClientConfigFromEnv } = await import('./core.js');

    expect(
      getKeycloakTenantAdminClientConfigFromEnv({
        realm: 'demo',
        clientId: 'sva-studio-admin',
        clientSecret: 'tenant-secret',
      })
    ).toEqual({
      baseUrl: 'https://keycloak.example',
      realm: 'demo',
      adminRealm: 'demo',
      clientId: 'sva-studio-admin',
      clientSecret: 'tenant-secret',
    });
  });

  it('normalizes the tenant-admin base URL fallback and rejects blank configuration', async () => {
    vi.stubEnv('KEYCLOAK_ADMIN_BASE_URL', '   ');
    vi.stubEnv('KEYCLOAK_PROVISIONER_BASE_URL', '  https://provisioner-keycloak.example  ');

    const { getKeycloakTenantAdminClientConfigFromEnv } = await import('./core.js');
    const input = {
      realm: 'demo',
      clientId: 'sva-studio-admin',
      clientSecret: 'tenant-secret',
    };

    expect(getKeycloakTenantAdminClientConfigFromEnv(input).baseUrl).toBe(
      'https://provisioner-keycloak.example'
    );

    vi.stubEnv('KEYCLOAK_PROVISIONER_BASE_URL', '   ');
    expect(() => getKeycloakTenantAdminClientConfigFromEnv(input)).toThrow(
      'Missing required env: KEYCLOAK_ADMIN_BASE_URL'
    );
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

    await expect(
      assignClient.assignRealmRoles('user-1', ['missing-role'])
    ).rejects.toMatchObject<KeycloakAdminRequestError>({
      code: 'unknown_role',
      statusCode: 400,
    });

    const removeFetch = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'role-a', name: 'role-a' }]));
    const removeClient = await createClient(removeFetch);

    await expect(
      removeClient.removeRealmRoles('user-1', ['missing-role'])
    ).resolves.toBeUndefined();
    expect(removeFetch).toHaveBeenCalledTimes(2);
  });

  it('does not expose the unsupported realm role count endpoint', async () => {
    const client = await createClient(vi.fn());

    expect('countRoles' in client).toBe(false);
  });

  it('maps missing role lookups to null', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }));

    const client = await createClient(fetchImpl);

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

    await expect(client.ensureRealm({ displayName: 'Demo Realm' })).resolves.toBe(true);
    await expect(client.ensureRealm({ displayName: 'Demo Realm' })).resolves.toBe(false);
    expect(state.logger.info).toHaveBeenCalledWith(
      'create_realm',
      expect.objectContaining({ operation: 'create_realm', realm: 'demo' })
    );
  });

  it('refreshes the cached token after creating a realm before reading clients in that realm', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-2', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []));

    const client = await createClient(fetchImpl);

    await expect(client.ensureRealm({ displayName: 'Demo Realm' })).resolves.toBe(true);
    await expect(client.getOidcClientByClientId('sva-studio-login')).resolves.toBeNull();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://keycloak.example/realms/demo/protocol/openid-connect/token',
      expect.objectContaining({
        body: 'grant_type=client_credentials&client_id=studio&client_secret=secret',
        method: 'POST',
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      'https://keycloak.example/admin/realms/demo/clients?clientId=sva-studio-login',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-2',
        }),
        method: 'GET',
      })
    );
  });

  it('deletes a created realm and accepts an already missing realm as cleaned up', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-2', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }));
    const client = await createClient(fetchImpl);

    await expect(client.deleteRealm()).resolves.toBeUndefined();
    await expect(client.deleteRealm()).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://keycloak.example/admin/realms/demo',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(state.logger.info).toHaveBeenCalledWith(
      'delete_realm',
      expect.objectContaining({ operation: 'delete_realm', realm: 'demo' })
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

  it('changes an OIDC client enabled state idempotently', async () => {
    const enabledClient = { id: 'client-1', clientId: 'ssf', enabled: true };
    const disabledClient = { ...enabledClient, enabled: false };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [enabledClient]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [disabledClient]));
    const client = await createClient(fetchImpl);

    await client.setOidcClientEnabled('ssf', false);
    await client.setOidcClientEnabled('ssf', false);

    const updateCalls = fetchImpl.mock.calls.filter(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'PUT'
    );
    expect(updateCalls).toHaveLength(1);
    expect(JSON.parse(String(updateCalls[0]?.[1]?.body))).toMatchObject({
      clientId: 'ssf',
      enabled: false,
    });
  });

  it('sends an explicit recovery rotation request without a secret value when the registry secret is missing', async () => {
    const existingClient = {
      id: 'client-1',
      clientId: 'web-app',
      rootUrl: 'https://tenant.example',
      redirectUris: ['https://tenant.example/callback'],
      webOrigins: ['https://tenant.example'],
      attributes: { 'post.logout.redirect.uris': 'https://tenant.example/logout' },
      standardFlowEnabled: true,
      publicClient: false,
      directAccessGrantsEnabled: false,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [existingClient]))
      .mockResolvedValueOnce(createJsonResponse(200, [existingClient]))
      .mockResolvedValueOnce(createJsonResponse(200, { value: 'old-secret' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://tenant.example/callback'],
      postLogoutRedirectUris: ['https://tenant.example/logout'],
      webOrigins: ['https://tenant.example'],
      rootUrl: 'https://tenant.example',
      rotateClientSecret: true,
    });

    const rotateCall = fetchImpl.mock.calls.find(
      (call) =>
        String(call[0]).includes('/clients/client-1/client-secret') && call[1]?.method === 'POST'
    );
    expect(rotateCall).toBeDefined();
    expect(rotateCall?.[1]?.body).toBe(JSON.stringify({ type: 'secret' }));
  });

  it('preserves existing OIDC client access settings when adding missing redirect and origin entries', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'client-1',
            clientId: 'web-app',
            rootUrl: 'https://new.example',
            redirectUris: ['https://legacy.example/callback'],
            webOrigins: ['https://legacy.example'],
            attributes: { 'post.logout.redirect.uris': 'https://legacy.example/logout' },
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://new.example/callback'],
      postLogoutRedirectUris: ['https://new.example/logout'],
      webOrigins: ['https://new.example'],
      rootUrl: 'https://new.example',
    });

    const updateCall = fetchImpl.mock.calls.find(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'PUT'
    );
    expect(updateCall).toBeDefined();
    const body = JSON.parse(String(updateCall?.[1]?.body)) as {
      redirectUris?: string[];
      webOrigins?: string[];
      attributes?: { 'post.logout.redirect.uris'?: string };
    };
    expect(body.redirectUris).toEqual([
      'https://legacy.example/callback',
      'https://new.example/callback',
    ]);
    expect(body.webOrigins).toEqual(['https://legacy.example', 'https://new.example']);
    expect(body.attributes?.['post.logout.redirect.uris']?.split('##')).toEqual([
      'https://legacy.example/logout',
      'https://new.example/logout',
    ]);
  });

  it('removes existing callback access when strict URI replacement is requested', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'client-1',
            clientId: 'ssf',
            enabled: true,
            rootUrl: 'https://legacy.example',
            redirectUris: ['https://legacy.example/callback'],
            webOrigins: ['https://legacy.example'],
            attributes: { 'post.logout.redirect.uris': 'https://legacy.example/logout' },
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
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

    const updateCall = fetchImpl.mock.calls.find(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'PUT'
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      enabled: false,
      implicitFlowEnabled: false,
      rootUrl: '',
      redirectUris: [],
      webOrigins: [],
      attributes: { 'post.logout.redirect.uris': '' },
    });
  });

  it('removes wildcard callback defaults that Keycloak adds to an empty client allowlist', async () => {
    const createdClient = {
      id: 'client-1',
      clientId: 'ssf',
      enabled: false,
      rootUrl: '',
      redirectUris: ['/*'],
      webOrigins: ['/*'],
      attributes: { realm_client: 'false', 'client.secret.creation.time': '123' },
      publicClient: false,
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      protocol: 'openid-connect',
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [createdClient]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
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
    });

    const updateCall = fetchImpl.mock.calls.find(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'PUT'
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      enabled: false,
      rootUrl: '',
      redirectUris: [],
      webOrigins: [],
      attributes: {
        realm_client: 'false',
        'client.secret.creation.time': '123',
        'post.logout.redirect.uris': '',
      },
    });
  });

  it('removes a wildcard default when only one client allowlist is empty', async () => {
    const createdClient = {
      id: 'client-1',
      clientId: 'web-app',
      redirectUris: ['https://web.example/callback'],
      webOrigins: ['/*'],
      attributes: {},
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [createdClient]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://web.example/callback'],
      postLogoutRedirectUris: [],
      webOrigins: [],
      rootUrl: 'https://web.example',
    });

    const updateCall = fetchImpl.mock.calls.find(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'PUT'
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      redirectUris: ['https://web.example/callback'],
      webOrigins: [],
    });
  });

  it('deletes a newly created client when its strict readback repair fails', async () => {
    const createdClient = {
      id: 'client-1',
      clientId: 'ssf',
      enabled: false,
      rootUrl: '',
      redirectUris: ['/*'],
      webOrigins: ['/*'],
      attributes: {},
      publicClient: false,
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      protocol: 'openid-connect',
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [createdClient]))
      .mockResolvedValueOnce(createJsonResponse(400, { error: 'invalid_client' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, { realm: 'demo' }));
    const client = await createClient(fetchImpl, { circuitBreakerFailureThreshold: 1 });

    await expect(
      client.ensureOidcClient({
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
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    const deleteCall = fetchImpl.mock.calls.find(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'DELETE'
    );
    expect(deleteCall).toBeDefined();
    await expect(client.getRealm()).resolves.toEqual({ realm: 'demo' });
  });

  it('retries transient failures while deleting a failed strict client creation', async () => {
    const createdClient = {
      id: 'client-1',
      clientId: 'ssf',
      redirectUris: ['/*'],
      webOrigins: ['/*'],
      attributes: {},
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [createdClient]))
      .mockResolvedValueOnce(createJsonResponse(400, { error: 'invalid_client' }))
      .mockResolvedValueOnce(createJsonResponse(503, { error: 'temporarily_unavailable' }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'client_not_found' }));
    const client = await createClient(fetchImpl, {
      circuitBreakerFailureThreshold: 1,
      maxRetries: 1,
    });

    await expect(
      client.ensureOidcClient({
        clientId: 'ssf',
        redirectUris: [],
        postLogoutRedirectUris: [],
        webOrigins: [],
        rootUrl: '',
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(
      fetchImpl.mock.calls.filter(
        (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'DELETE'
      )
    ).toHaveLength(2);
  });

  it('deletes a newly created strict client when its immediate readback fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: {
            location: 'https://keycloak.example/admin/realms/demo/clients/client-1',
          },
        })
      )
      .mockResolvedValueOnce(createJsonResponse(503, { error: 'temporarily_unavailable' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = await createClient(fetchImpl, { maxRetries: 0 });

    await expect(
      client.ensureOidcClient({
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
      })
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(
      fetchImpl.mock.calls.some(
        (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'DELETE'
      )
    ).toBe(true);
  });

  it('requires manual action when strict client repair and cleanup both fail', async () => {
    const createdClient = {
      id: 'client-1',
      clientId: 'ssf',
      redirectUris: ['/*'],
      webOrigins: ['/*'],
      attributes: {},
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [createdClient]))
      .mockResolvedValueOnce(createJsonResponse(400, { error: 'invalid_client' }))
      .mockResolvedValueOnce(createJsonResponse(500, { error: 'cleanup_failed' }));
    const client = await createClient(fetchImpl, { maxRetries: 0 });

    const error = await client
      .ensureOidcClient({
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
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      message: 'strict_oidc_client_reconciliation_failed_cleanup_failed_requires_manual_action',
      cause: { statusCode: 500, code: 'http_500' },
    });
  });

  it('skips a redundant update when Keycloak preserves strict client settings on creation', async () => {
    const createdClient = {
      id: 'client-1',
      clientId: 'ssf',
      enabled: false,
      rootUrl: '',
      redirectUris: [],
      webOrigins: [],
      attributes: { 'post.logout.redirect.uris': '' },
      publicClient: false,
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      protocol: 'openid-connect',
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [createdClient]));
    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
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

    expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(false);
  });

  it('grants required realm-management client roles to the tenant admin service account', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'tenant-admin-client-id', clientId: 'tenant-admin' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'realm-management-client-id', clientId: 'realm-management' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'service-account-user-id',
          username: 'service-account-tenant-admin',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-manage-clients', name: 'manage-clients' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'role-view-users', name: 'view-users' }])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      );

    const client = await createClient(fetchImpl);

    await client.ensureTenantAdminServiceAccess('tenant-admin');

    const addRolesCall = fetchImpl.mock.calls[6];
    expect(String(addRolesCall?.[0])).toContain(
      '/users/service-account-user-id/role-mappings/clients/realm-management-client-id'
    );
    expect(addRolesCall?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(addRolesCall?.[1]?.body))).toEqual([
      { id: 'role-manage-users', name: 'manage-users' },
      { id: 'role-view-realm', name: 'view-realm' },
      { id: 'role-manage-realm', name: 'manage-realm' },
      { id: 'role-view-clients', name: 'view-clients' },
    ]);
  });

  it('removes legacy client write access after client read access is present', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'tenant-admin-client-id', clientId: 'tenant-admin' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'realm-management-client-id', clientId: 'realm-management' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'service-account-user-id',
          username: 'service-account-tenant-admin',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-manage-clients', name: 'manage-clients' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-manage-clients', name: 'manage-clients' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      );

    const client = await createClient(fetchImpl);

    await expect(client.ensureTenantAdminServiceAccess('tenant-admin')).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[6]?.[1]?.method).toBe('DELETE');
    expect(JSON.parse(String(fetchImpl.mock.calls[6]?.[1]?.body))).toEqual([
      { id: 'role-manage-clients', name: 'manage-clients' },
    ]);
    expect(fetchImpl.mock.calls[7]?.[1]?.method).toBe('GET');
    expect(String(fetchImpl.mock.calls[8]?.[0])).toContain('/composite');
    expect(fetchImpl).toHaveBeenCalledTimes(9);
  });

  it('adds client read access before revoking legacy client write access', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'tenant-admin-client-id', clientId: 'tenant-admin' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'realm-management-client-id', clientId: 'realm-management' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'service-account-user-id',
          username: 'service-account-tenant-admin',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-manage-clients', name: 'manage-clients' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-manage-clients', name: 'manage-clients' },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-view-clients', name: 'view-clients' },
        ])
      );

    const client = await createClient(fetchImpl);

    await client.ensureTenantAdminServiceAccess('tenant-admin');

    expect(fetchImpl.mock.calls[6]?.[1]?.method).toBe('POST');
    expect(fetchImpl.mock.calls[7]?.[1]?.method).toBe('DELETE');
    expect(fetchImpl.mock.calls[8]?.[1]?.method).toBe('GET');
    expect(String(fetchImpl.mock.calls[9]?.[0])).toContain('/composite');
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });

  it('fails closed when the tenant admin service role readback still has client write access', async () => {
    type KeycloakAdminRequestError = import('./core.js').KeycloakAdminRequestError;
    const roleMappings = [
      { id: 'role-manage-users', name: 'manage-users' },
      { id: 'role-view-users', name: 'view-users' },
      { id: 'role-view-realm', name: 'view-realm' },
      { id: 'role-manage-realm', name: 'manage-realm' },
      { id: 'role-manage-clients', name: 'manage-clients' },
      { id: 'role-view-clients', name: 'view-clients' },
    ];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'tenant-admin-client-id', clientId: 'tenant-admin' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'realm-management-client-id', clientId: 'realm-management' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'service-account-user-id',
          username: 'service-account-tenant-admin',
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, roleMappings))
      .mockResolvedValueOnce(createJsonResponse(200, roleMappings))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, roleMappings))
      .mockResolvedValueOnce(createJsonResponse(200, roleMappings));

    const client = await createClient(fetchImpl);

    await expect(
      client.ensureTenantAdminServiceAccess('tenant-admin')
    ).rejects.toMatchObject<KeycloakAdminRequestError>({
      code: 'tenant_admin_service_access_readback_failed',
      statusCode: 500,
    });
  });

  it('skips tenant admin service role updates when the exact required roles are assigned', async () => {
    const exactRoles = [
      { id: 'role-manage-users', name: 'manage-users' },
      { id: 'role-view-users', name: 'view-users' },
      { id: 'role-view-realm', name: 'view-realm' },
      { id: 'role-manage-realm', name: 'manage-realm' },
      { id: 'role-view-clients', name: 'view-clients' },
    ];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'tenant-admin-client-id', clientId: 'tenant-admin' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'realm-management-client-id', clientId: 'realm-management' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'service-account-user-id',
          username: 'service-account-tenant-admin',
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, exactRoles))
      .mockResolvedValueOnce(createJsonResponse(200, exactRoles))
      .mockResolvedValueOnce(createJsonResponse(200, exactRoles))
      .mockResolvedValueOnce(createJsonResponse(200, exactRoles));

    const client = await createClient(fetchImpl);

    await expect(client.ensureTenantAdminServiceAccess('tenant-admin')).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls.slice(1).some((call) => call[1]?.method === 'POST')).toBe(false);
    expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(false);
    expect(String(fetchImpl.mock.calls[7]?.[0])).toContain('/composite');
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });

  it('fails closed when client write access remains effective through inherited role mappings', async () => {
    type KeycloakAdminRequestError = import('./core.js').KeycloakAdminRequestError;
    const directRoles = [
      { id: 'role-manage-users', name: 'manage-users' },
      { id: 'role-view-users', name: 'view-users' },
      { id: 'role-view-realm', name: 'view-realm' },
      { id: 'role-manage-realm', name: 'manage-realm' },
      { id: 'role-view-clients', name: 'view-clients' },
    ];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'tenant-admin-client-id', clientId: 'tenant-admin' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'realm-management-client-id', clientId: 'realm-management' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'service-account-user-id',
          username: 'service-account-tenant-admin',
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, directRoles))
      .mockResolvedValueOnce(createJsonResponse(200, directRoles))
      .mockResolvedValueOnce(createJsonResponse(200, directRoles))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          ...directRoles,
          { id: 'role-manage-clients', name: 'manage-clients' },
        ])
      );

    const client = await createClient(fetchImpl);

    await expect(
      client.ensureTenantAdminServiceAccess('tenant-admin')
    ).rejects.toMatchObject<KeycloakAdminRequestError>({
      code: 'tenant_admin_service_access_readback_failed',
      statusCode: 500,
    });
    expect(String(fetchImpl.mock.calls[7]?.[0])).toContain(
      '/role-mappings/clients/realm-management-client-id/composite'
    );
  });

  it('fails tenant admin service access provisioning when a required realm-management role is missing', async () => {
    type KeycloakAdminRequestError = import('./core.js').KeycloakAdminRequestError;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'tenant-admin-client-id', clientId: 'tenant-admin' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'realm-management-client-id', clientId: 'realm-management' },
        ])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'service-account-user-id',
          username: 'service-account-tenant-admin',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'role-manage-users', name: 'manage-users' },
          { id: 'role-view-users', name: 'view-users' },
          { id: 'role-view-realm', name: 'view-realm' },
          { id: 'role-manage-realm', name: 'manage-realm' },
          { id: 'role-manage-clients', name: 'manage-clients' },
        ])
      )
      .mockResolvedValueOnce(createJsonResponse(200, []));

    const client = await createClient(fetchImpl);

    await expect(
      client.ensureTenantAdminServiceAccess('tenant-admin')
    ).rejects.toMatchObject<KeycloakAdminRequestError>({
      code: 'realm_management_role_missing',
      statusCode: 500,
    });
  });

  it('fails tenant admin service access provisioning when the target client is missing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []));

    const client = await createClient(fetchImpl);

    await expect(client.ensureTenantAdminServiceAccess('tenant-admin')).rejects.toMatchObject<
      import('./core.js').KeycloakAdminRequestError
    >({ code: 'unknown_client', statusCode: 404 });
  });

  it('does not regenerate a client secret during normal reconciliation when the configured secret differs', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'client-1',
            clientId: 'web-app',
            rootUrl: 'https://new.example',
            redirectUris: ['https://new.example/callback'],
            webOrigins: ['https://new.example'],
            attributes: { 'post.logout.redirect.uris': 'https://new.example/logout' },
          },
        ])
      )
      .mockResolvedValueOnce(createJsonResponse(200, { value: 'keycloak-secret' }));

    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://new.example/callback'],
      postLogoutRedirectUris: ['https://new.example/logout'],
      webOrigins: ['https://new.example'],
      rootUrl: 'https://new.example',
      clientSecret: 'registry-secret',
      rotateClientSecret: false,
    });

    expect(
      fetchImpl.mock.calls.some(
        (call) => String(call[0]).includes('/client-secret') && call[1]?.method === 'POST'
      )
    ).toBe(false);
  });

  it('updates an existing OIDC client when only flow flags drift', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'client-1',
            clientId: 'web-app',
            rootUrl: 'https://new.example',
            redirectUris: ['https://new.example/callback'],
            webOrigins: ['https://new.example'],
            standardFlowEnabled: true,
            implicitFlowEnabled: true,
            directAccessGrantsEnabled: true,
            serviceAccountsEnabled: false,
            attributes: { 'post.logout.redirect.uris': 'https://new.example/logout' },
          },
        ])
      )
      .mockResolvedValueOnce(createJsonResponse(200, { value: 'stable-secret' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://new.example/callback'],
      postLogoutRedirectUris: ['https://new.example/logout'],
      webOrigins: ['https://new.example'],
      rootUrl: 'https://new.example',
      clientSecret: 'stable-secret',
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: true,
    });

    const updateCall = fetchImpl.mock.calls.find(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'PUT'
    );
    expect(updateCall).toBeDefined();
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      implicitFlowEnabled: false,
    });
  });

  it('updates an existing OIDC client when only protocol or confidentiality mode drift', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            id: 'client-1',
            clientId: 'web-app',
            enabled: true,
            protocol: 'saml',
            publicClient: true,
            rootUrl: 'https://new.example',
            redirectUris: ['https://new.example/callback'],
            webOrigins: ['https://new.example'],
            standardFlowEnabled: true,
            implicitFlowEnabled: false,
            directAccessGrantsEnabled: false,
            serviceAccountsEnabled: false,
            attributes: { 'post.logout.redirect.uris': 'https://new.example/logout' },
          },
        ])
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = await createClient(fetchImpl);

    await client.ensureOidcClient({
      clientId: 'web-app',
      redirectUris: ['https://new.example/callback'],
      postLogoutRedirectUris: ['https://new.example/logout'],
      webOrigins: ['https://new.example'],
      rootUrl: 'https://new.example',
    });

    const updateCall = fetchImpl.mock.calls.find(
      (call) => String(call[0]).includes('/clients/client-1') && call[1]?.method === 'PUT'
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      protocol: 'openid-connect',
      publicClient: false,
    });
  });

  it('adds admin-only managed user-profile attributes without changing existing fields', async () => {
    const existingProfile = {
      unmanagedAttributePolicy: 'DISABLED',
      attributes: [
        {
          name: 'email',
          displayName: '${email}',
          permissions: { view: ['admin', 'user'], edit: ['admin', 'user'] },
        },
        {
          name: 'ssf_roles',
          displayName: 'SSF roles',
          multivalued: false,
          permissions: { view: ['admin', 'user'], edit: ['user'] },
        },
      ],
      groups: [{ name: 'identity', displayHeader: 'Identity' }],
    };
    const expectedAttributes = [
      existingProfile.attributes[0],
      {
        ...existingProfile.attributes[1],
        multivalued: true,
        permissions: { view: ['admin'], edit: ['admin'] },
      },
      {
        name: 'studio_tenant_id',
        multivalued: false,
        permissions: { view: ['admin'], edit: ['admin'] },
      },
    ];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, existingProfile))
      .mockResolvedValueOnce(createJsonResponse(200, existingProfile))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          ...existingProfile,
          attributes: [...expectedAttributes].reverse(),
          keycloakAddedField: true,
        })
      );
    const client = await createClient(fetchImpl);

    await client.ensureAdminOnlyUserProfileAttributes([
      { name: 'studio_tenant_id', multivalued: false },
      { name: 'ssf_roles', multivalued: true },
    ]);

    const updateCall = fetchImpl.mock.calls.find((call) => call[1]?.method === 'PUT');
    expect(String(updateCall?.[0])).toContain('/admin/realms/demo/users/profile');
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      ...existingProfile,
      attributes: expectedAttributes,
    });
  });

  it('does not rewrite a complete admin-only user profile', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          attributes: [
            {
              name: 'ssf_permissions',
              multivalued: true,
              permissions: { view: ['admin'], edit: ['admin'] },
            },
          ],
        })
      );
    const client = await createClient(fetchImpl);

    await client.ensureAdminOnlyUserProfileAttributes([
      { name: 'ssf_permissions', multivalued: true },
    ]);

    expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(false);
  });

  it('fails closed when a user-profile update cannot be confirmed', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, { attributes: [] }))
      .mockResolvedValueOnce(createJsonResponse(200, { attributes: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, { attributes: [] }));
    const client = await createClient(fetchImpl);

    await expect(
      client.ensureAdminOnlyUserProfileAttributes([{ name: 'ssf_roles', multivalued: true }])
    ).rejects.toMatchObject({
      code: 'user_profile_attribute_readback_mismatch',
      retryable: true,
    });
  });

  it('fails closed when a user-profile update drops retained configuration', async () => {
    const existingProfile = {
      unmanagedAttributePolicy: 'DISABLED',
      attributes: [{ name: 'email', displayName: '${email}' }],
      groups: [{ name: 'identity', displayHeader: 'Identity' }],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, existingProfile))
      .mockResolvedValueOnce(createJsonResponse(200, existingProfile))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          attributes: [
            {
              name: 'ssf_roles',
              multivalued: true,
              permissions: { view: ['admin'], edit: ['admin'] },
            },
          ],
        })
      );
    const client = await createClient(fetchImpl);

    await expect(
      client.ensureAdminOnlyUserProfileAttributes([{ name: 'ssf_roles', multivalued: true }])
    ).rejects.toMatchObject({
      code: 'user_profile_preservation_readback_mismatch',
      retryable: false,
    });
  });

  it('reads the admin-only user-profile contract without writing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          attributes: [
            {
              name: 'ssf_permissions',
              multivalued: true,
              permissions: { view: ['admin'], edit: ['admin'] },
            },
          ],
        })
      );
    const client = await createClient(fetchImpl);

    await expect(
      client.hasAdminOnlyUserProfileAttributes([{ name: 'ssf_permissions', multivalued: true }])
    ).resolves.toBe(true);
    expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(false);
  });

  it('fails before writing when the user profile changes concurrently', async () => {
    const initialProfile = {
      attributes: [{ name: 'email', displayName: '${email}' }],
      groups: [{ name: 'identity', displayHeader: 'Identity' }],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, initialProfile))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          ...initialProfile,
          groups: [...initialProfile.groups, { name: 'address', displayHeader: 'Address' }],
        })
      );
    const client = await createClient(fetchImpl);

    await expect(
      client.ensureAdminOnlyUserProfileAttributes([{ name: 'ssf_roles', multivalued: true }])
    ).rejects.toMatchObject({
      code: 'user_profile_concurrent_modification',
      retryable: true,
    });
    expect(fetchImpl.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(false);
  });

  it('reports a user-editable managed profile attribute as unsafe', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          attributes: [
            {
              name: 'ssf_permissions',
              multivalued: true,
              permissions: { view: ['admin', 'user'], edit: ['admin', 'user'] },
            },
          ],
        })
      );
    const client = await createClient(fetchImpl);

    await expect(
      client.hasAdminOnlyUserProfileAttributes([{ name: 'ssf_permissions', multivalued: true }])
    ).resolves.toBe(false);
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
      multivalued: true,
    });
    await client.ensureUserAttributeProtocolMapper({
      clientId: 'web-app',
      name: 'instance-id',
      userAttribute: 'tenantId',
      claimName: 'instanceId',
    });

    expect(String(fetchImpl.mock.calls[3]?.[0])).toContain('/protocol-mappers/models');
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toMatchObject({
      config: { multivalued: 'true' },
    });
    expect(String(fetchImpl.mock.calls[7]?.[0])).toContain('/protocol-mappers/models/mapper-1');
  });

  it('creates an SSF audience mapper once and then verifies it idempotently', async () => {
    const keycloakClient = { id: 'client-1', clientId: 'ssf' };
    const audienceMapper = {
      id: 'mapper-1',
      name: 'studio-ssf-audience',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-audience-mapper',
      config: {
        'included.client.audience': 'ssf',
        'included.custom.audience': '',
        'id.token.claim': 'false',
        'access.token.claim': 'true',
        'lightweight.claim': 'false',
        'introspection.token.claim': 'true',
      },
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [keycloakClient]))
      .mockResolvedValueOnce(createJsonResponse(200, [keycloakClient]))
      .mockResolvedValueOnce(createJsonResponse(200, []))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(createJsonResponse(200, [keycloakClient]))
      .mockResolvedValueOnce(createJsonResponse(200, [keycloakClient]))
      .mockResolvedValueOnce(createJsonResponse(200, [audienceMapper]));
    const client = await createClient(fetchImpl);

    await client.ensureAudienceProtocolMapper({
      clientId: 'ssf',
      name: 'studio-ssf-audience',
      audience: 'ssf',
    });
    await client.ensureAudienceProtocolMapper({
      clientId: 'ssf',
      name: 'studio-ssf-audience',
      audience: 'ssf',
    });

    const mapperWrites = fetchImpl.mock.calls.filter(
      (call) => String(call[0]).includes('/protocol-mappers/models') && call[1]?.method !== 'GET'
    );
    expect(mapperWrites).toHaveLength(1);
    expect(JSON.parse(String(mapperWrites[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        protocolMapper: 'oidc-audience-mapper',
        config: expect.objectContaining({ 'included.client.audience': 'ssf' }),
      })
    );
  });

  it('finds users by exact username and case-insensitive email', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          { id: 'user-1', username: 'ALICE', email: 'Alice@example.com' },
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
    await expect(client.findUserByEmail('alice@EXAMPLE.com')).resolves.toMatchObject({
      id: 'user-1',
    });
  });

  it('requests full user representations when explicitly required', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'user-1', attributes: { locale: ['de'] } }])
      );
    const client = await createClient(fetchImpl);

    await expect(
      client.listUsers({ first: 0, max: 100, briefRepresentation: false })
    ).resolves.toEqual([
      expect.objectContaining({ externalId: 'user-1', attributes: { locale: ['de'] } }),
    ]);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('briefRepresentation=false');
  });

  it('forwards exact user matching to Keycloak', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, []));
    const client = await createClient(fetchImpl);

    await expect(
      client.listUsers({ username: 'tenant.admin', exact: true, max: 1 })
    ).resolves.toEqual([]);

    const requestUrl = String(fetchImpl.mock.calls[1]?.[0]);
    expect(requestUrl).toContain('username=tenant.admin');
    expect(requestUrl).toContain('exact=true');
    expect(requestUrl).toContain('max=1');
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

    await expect(client.getUserAttributes('user-1', ['locale'])).resolves.toEqual({
      locale: ['de'],
    });
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

  it('reads effective protocol mappers including attached client scopes', async () => {
    const directMapper = {
      id: 'mapper-direct',
      name: 'direct-claim',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-usermodel-attribute-mapper',
      config: { 'claim.name': 'studio_tenant_id' },
    };
    const inheritedMapper = {
      id: 'mapper-inherited',
      name: 'inherited-claim',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-hardcoded-claim-mapper',
      config: { 'claim.name': 'ssf_permissions' },
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'client-1', clientId: 'ssf-frontend' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            mapperId: 'mapper-direct',
            mapperName: 'direct-claim',
            containerId: 'client-1',
            containerName: 'ssf-frontend',
            containerType: 'client',
            protocolMapper: 'oidc-usermodel-attribute-mapper',
          },
          {
            mapperId: 'mapper-inherited',
            mapperName: 'inherited-claim',
            containerId: 'scope-1',
            containerName: 'profile',
            containerType: 'client-scope',
            protocolMapper: 'oidc-hardcoded-claim-mapper',
          },
        ])
      )
      .mockResolvedValueOnce(createJsonResponse(200, [directMapper]))
      .mockResolvedValueOnce(createJsonResponse(200, [inheritedMapper]));
    const client = await createClient(fetchImpl);

    await expect(client.listEffectiveClientProtocolMappers('ssf-frontend')).resolves.toEqual([
      directMapper,
      inheritedMapper,
    ]);
    expect(String(fetchImpl.mock.calls[2]?.[0])).toContain(
      '/clients/client-1/evaluate-scopes/protocol-mappers'
    );
    expect(String(fetchImpl.mock.calls.at(-1)?.[0])).toContain(
      '/client-scopes/scope-1/protocol-mappers/models'
    );
  });

  it('fails closed when effective protocol mapper metadata cannot be resolved', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, [{ id: 'client-1', clientId: 'ssf-frontend' }])
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, [
          {
            mapperId: 'missing-mapper',
            mapperName: 'missing-claim',
            containerId: 'client-1',
            containerName: 'ssf-frontend',
            containerType: 'client',
            protocolMapper: 'oidc-hardcoded-claim-mapper',
          },
        ])
      )
      .mockResolvedValueOnce(createJsonResponse(200, []));
    const client = await createClient(fetchImpl);

    await expect(client.listEffectiveClientProtocolMappers('ssf-frontend')).rejects.toMatchObject({
      code: 'effective_protocol_mapper_unresolved',
      retryable: false,
      statusCode: 502,
    });
  });

  it('repairs provisioning metadata on an existing realm role for the Studio instance', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['demo'],
            role_key: ['system_admin'],
            display_name: ['System Administrator'],
          },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['tenant-havelland'],
            role_key: ['system_admin'],
            display_name: ['System Administrator'],
          },
        })
      );
    const client = await createClient(fetchImpl);

    await expect(
      client.ensureRealmRole('system_admin', 'tenant-havelland', {
        allowLegacyRealmRoleMigration: true,
      })
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://keycloak.example/admin/realms/demo/roles/system_admin',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['tenant-havelland'],
            role_key: ['system_admin'],
            display_name: ['System Administrator'],
          },
        }),
      })
    );
  });

  it('creates a missing realm role with the Studio instance id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['tenant-havelland'],
            role_key: ['system_admin'],
            display_name: ['system_admin'],
          },
        })
      );
    const client = await createClient(fetchImpl);

    await expect(
      client.ensureRealmRole('system_admin', 'tenant-havelland')
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://keycloak.example/admin/realms/demo/roles',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['tenant-havelland'],
            role_key: ['system_admin'],
            display_name: ['system_admin'],
          },
        }),
      })
    );
  });

  it('rejects an unmanaged realm role created concurrently', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }))
      .mockResolvedValueOnce(createJsonResponse(409, { error: 'exists' }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {},
        })
      );
    const client = await createClient(fetchImpl);

    await expect(client.ensureRealmRole('system_admin', 'tenant-havelland')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('rejects multi-value ownership markers on a realm role created concurrently', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(404, { error: 'not_found' }))
      .mockResolvedValueOnce(createJsonResponse(409, { error: 'exists' }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio', 'other'],
            instance_id: ['tenant-havelland'],
            role_key: ['system_admin'],
          },
        })
      );
    const client = await createClient(fetchImpl);

    await expect(client.ensureRealmRole('system_admin', 'tenant-havelland')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('rejects an existing realm role owned by another Studio instance', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['tenant-other'],
            role_key: ['system_admin'],
            display_name: ['System Administrator'],
          },
        })
      );
    const client = await createClient(fetchImpl);

    await expect(client.ensureRealmRole('system_admin', 'tenant-havelland')).rejects.toMatchObject({
      statusCode: 409,
      code: 'role_ownership_conflict',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects an existing realm role with an incomplete Studio ownership marker', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['tenant-havelland'],
            display_name: ['System Administrator'],
          },
        })
      );
    const client = await createClient(fetchImpl);

    await expect(client.ensureRealmRole('system_admin', 'tenant-havelland')).rejects.toMatchObject({
      statusCode: 409,
      code: 'role_ownership_conflict',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects conflicting multi-value Studio ownership markers', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio', 'other'],
            instance_id: ['tenant-havelland'],
            role_key: ['system_admin'],
          },
        })
      );
    const client = await createClient(fetchImpl);

    await expect(client.ensureRealmRole('system_admin', 'tenant-havelland')).rejects.toMatchObject({
      statusCode: 409,
      code: 'role_ownership_conflict',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects a legacy realm binding unless its registry assignment is unique', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          id: 'role-1',
          name: 'system_admin',
          attributes: {
            managed_by: ['studio'],
            instance_id: ['demo'],
            role_key: ['system_admin'],
          },
        })
      );
    const client = await createClient(fetchImpl);

    await expect(client.ensureRealmRole('system_admin', 'tenant-havelland')).rejects.toMatchObject({
      statusCode: 409,
      code: 'role_ownership_conflict',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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

    await expect(
      client.setUserRequiredActions('user-1', ['UPDATE_PASSWORD'])
    ).resolves.toBeUndefined();
    await expect(client.setUserPassword('user-1', 'secret', false)).rejects.toBeInstanceOf(
      KeycloakAdminRequestError
    );
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

describe('public PKCE OIDC clients', () => {
  it('repairs PKCE drift without touching secrets or retaining broad origins', async () => {
    const existing = {
      id: 'browser',
      clientId: 'ssf-frontend',
      enabled: false,
      protocol: 'openid-connect',
      publicClient: true,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      rootUrl: '',
      redirectUris: ['https://dialog.example.org/login/*'],
      webOrigins: ['*'],
      attributes: { 'pkce.code.challenge.method': 'plain', 'access.token.lifespan': '3600' },
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token', expires_in: 120 }))
      .mockResolvedValueOnce(createJsonResponse(200, [existing]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = await createClient(fetchImpl);
    await client.ensureOidcClient({
      clientId: 'ssf-frontend',
      enabled: false,
      publicClient: true,
      pkceCodeChallengeMethod: 'S256',
      accessTokenLifespan: 900,
      redirectUris: existing.redirectUris,
      webOrigins: ['https://dialog.example.org'],
      postLogoutRedirectUris: [],
      rootUrl: '',
      uriPolicy: 'replace',
    });
    const writes = fetchImpl.mock.calls.filter((call) => call[1]?.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0]?.[1]?.body))).toMatchObject({
      publicClient: true,
      webOrigins: ['https://dialog.example.org'],
      attributes: { 'pkce.code.challenge.method': 'S256', 'access.token.lifespan': '900' },
    });
    expect(fetchImpl.mock.calls.some((call) => String(call[0]).includes('client-secret'))).toBe(
      false
    );
  });
});

it('replaces only competing mappers for an explicitly owned client claim', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(createJsonResponse(200, { access_token: 'token', expires_in: 120 }))
    .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'browser', clientId: 'ssf-frontend' }]))
    .mockResolvedValueOnce(createJsonResponse(200, [{ id: 'browser', clientId: 'ssf-frontend' }]))
    .mockResolvedValueOnce(
      createJsonResponse(200, [
        {
          id: 'legacy',
          name: 'manual-revision',
          protocolMapper: 'oidc-hardcoded-claim-mapper',
          config: { 'claim.name': 'ssf_authorization_revision' },
        },
        { id: 'unrelated', name: 'locale', config: { 'claim.name': 'locale' } },
      ])
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 201 }));
  const client = await createClient(fetchImpl);
  await client.ensureUserAttributeProtocolMapper({
    clientId: 'ssf-frontend',
    name: 'studio-ssf-authorization-revision',
    userAttribute: 'ssf_authorization_revision',
    claimName: 'ssf_authorization_revision',
    exclusiveClaim: true,
  });
  const deletions = fetchImpl.mock.calls.filter((call) => call[1]?.method === 'DELETE');
  expect(deletions).toHaveLength(1);
  expect(String(deletions[0]?.[0])).toContain('/clients/browser/protocol-mappers/models/legacy');
});
