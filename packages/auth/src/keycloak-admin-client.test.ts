import { describe, expect, it, vi } from 'vitest';

import {
  getKeycloakAdminClientConfigFromEnv,
  KeycloakAdminClient,
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from './keycloak-admin-client';

type FetchCall = {
  readonly input: string | URL;
  readonly init?: RequestInit;
};

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

const createJsonResponse = (status: number, body: unknown, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: headers
      ? {
          'Content-Type': 'application/json',
          ...headers,
        }
      : {
          'Content-Type': 'application/json',
        },
  });

const createTextResponse = (status: number, body: string, headers?: HeadersInit): Response =>
  new Response(status === 204 ? null : body, {
    status,
    headers: headers ?? {},
  });

const createFetchStub = (responses: Array<Response | (() => Response)>) => {
  const queue: Mutable<typeof responses> = [...responses];
  const calls: FetchCall[] = [];

  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ input, init });
    const entry = queue.shift();
    if (!entry) {
      throw new Error(`Unexpected fetch call for ${String(input)}`);
    }
    return typeof entry === 'function' ? entry() : entry;
  };

  return { fetchImpl, calls };
};

describe('KeycloakAdminClient', () => {
  it('creates user and reads external id from location header', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 300 }),
      createTextResponse(201, '', {
        Location: 'https://keycloak.example.com/admin/realms/demo/users/user-123',
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    const result = await client.createUser({
      email: 'user@example.com',
      firstName: 'Max',
      lastName: 'Mustermann',
      enabled: true,
    });

    expect(result).toEqual({ externalId: 'user-123' });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.init?.body).toBe(
      JSON.stringify({
        username: 'user@example.com',
        email: 'user@example.com',
        firstName: 'Max',
        lastName: 'Mustermann',
        enabled: true,
      })
    );
  });

  it('fails createUser when location header is missing', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 300 }),
      createTextResponse(201, ''),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    await expect(
      client.createUser({
        email: 'user@example.com',
      })
    ).rejects.toMatchObject({
      code: 'missing_location_header',
      statusCode: 502,
    });
  });

  it('uses raw location value without slash as external id', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 300 }),
      createTextResponse(201, '', {
        Location: 'user-plain-id',
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com///',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    const result = await client.createUser({
      email: 'user@example.com',
      attributes: {
        source: 'iam',
      },
    });

    expect(result.externalId).toBe('user-plain-id');
    expect(calls[1]?.init?.body).toBe(
      JSON.stringify({
        username: 'user@example.com',
        email: 'user@example.com',
        enabled: true,
        attributes: {
          source: ['iam'],
        },
      })
    );
  });

  it('surfaces Keycloak errorMessage values in request errors', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 300 }),
      createJsonResponse(400, { errorMessage: 'User name is missing' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    await expect(
      client.createUser({
        email: 'user@example.com',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Keycloak create_user failed: User name is missing',
    });
  });

  it('includes Keycloak field context in user profile validation errors', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 300 }),
      createJsonResponse(400, {
        field: 'instanceId',
        errorMessage: 'error-user-attribute-required',
        params: ['instanceId'],
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    await expect(
      client.createUser({
        email: 'user@example.com',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Keycloak create_user failed: error-user-attribute-required (instanceId)',
    });
  });

  it('caches service-account token between requests', async () => {
    let nowMs = 0;
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(200, []),
      createJsonResponse(200, []),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      now: () => nowMs,
    });

    await client.listRoles();
    nowMs += 1_000;
    await client.listRoles();

    const tokenRequests = calls.filter((entry) =>
      String(entry.input).includes('/protocol/openid-connect/token')
    );
    expect(tokenRequests).toHaveLength(1);
  });

  it('reads and filters user attributes by external id', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(200, {
        id: 'user-123',
        username: 'user@example.com',
        attributes: {
          sva_mainserver_api_key: ['key-1'],
          sva_mainserver_api_secret: ['secret-1'],
          ignored: ['value'],
        },
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    const attributes = await client.getUserAttributes('user-123', [
      'sva_mainserver_api_key',
      'sva_mainserver_api_secret',
    ]);

    expect(attributes).toEqual({
      sva_mainserver_api_key: ['key-1'],
      sva_mainserver_api_secret: ['secret-1'],
    });
    expect(String(calls[1]?.input)).toContain('/admin/realms/demo/users/user-123');
  });

  it('retries transient errors with exponential backoff delays', async () => {
    const sleepCalls: number[] = [];
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(200, []),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 2,
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    const roles = await client.listRoles();
    expect(roles).toEqual([]);
    expect(sleepCalls).toEqual([1_000, 2_000]);
  });

  it('opens circuit after five failed operations and blocks writes with 503 error', async () => {
    let nowMs = 0;
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      now: () => nowMs,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 5,
      circuitBreakerOpenMs: 30_000,
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.listRoles()).rejects.toBeInstanceOf(KeycloakAdminRequestError);
    }

    await expect(
      client.updateUser('user-1', {
        enabled: false,
      })
    ).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);

    nowMs += 30_001;
  });

  it('uses read fallback when circuit breaker is open', async () => {
    let nowMs = 0;
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      now: () => nowMs,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 5,
      readFallback: {
        listUsers: async () => [{ id: 'db-fallback-user' }],
      },
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.listRoles()).rejects.toBeInstanceOf(KeycloakAdminRequestError);
    }

    const users = await client.listUsers({ max: 25 });
    expect(users).toEqual([{ externalId: 'db-fallback-user' }]);
    nowMs += 1;
  });

  it('uses listRoles fallback when circuit breaker is open', async () => {
    let nowMs = 0;
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const fallbackListRoles = vi.fn(async () => [{ id: 'db-fallback-role', name: 'db_fallback_role' }]);
    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      now: () => nowMs,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 5,
      readFallback: {
        listRoles: fallbackListRoles,
      },
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.getRoleByName(`role-${i}`)).rejects.toBeInstanceOf(KeycloakAdminRequestError);
    }

    const roles = await client.listRoles();
    expect(roles).toEqual([expect.objectContaining({ id: 'db-fallback-role', externalName: 'db_fallback_role' })]);
    expect(fallbackListRoles).toHaveBeenCalledTimes(1);
    nowMs += 1;
  });

  it('uses listUsers fallback after retryable read error', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const fallbackListUsers = vi.fn(async () => [{ id: 'fallback-user-1' }]);
    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
      readFallback: {
        listUsers: fallbackListUsers,
      },
    });

    const users = await client.listUsers({ first: 1, max: 5, search: 'alice', email: 'a@example.com', username: 'alice', enabled: true });
    expect(users).toEqual([{ externalId: 'fallback-user-1' }]);
    expect(fallbackListUsers).toHaveBeenCalledTimes(1);
  });

  it('uses listRoles fallback after retryable read error', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const fallbackListRoles = vi.fn(async () => [{ id: 'role-fallback', name: 'fallback_role' }]);
    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
      readFallback: {
        listRoles: fallbackListRoles,
      },
    });

    const roles = await client.listRoles();
    expect(roles).toEqual([expect.objectContaining({ id: 'role-fallback', externalName: 'fallback_role' })]);
    expect(fallbackListRoles).toHaveBeenCalledTimes(1);
  });

  it('serializes updateUser attributes to string arrays', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createTextResponse(204, ''),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    await client.updateUser('user-1', {
      username: 'max.mustermann',
      email: 'user@example.com',
      firstName: 'Max',
      attributes: {
        locale: 'de',
        teams: ['alpha', 'beta'],
      },
    });

    const requestCall = calls.find((entry) => String(entry.input).includes('/users/user-1'));
    expect(requestCall).toBeDefined();
    const body = JSON.parse(String(requestCall?.init?.body)) as {
      username: string;
      attributes: Record<string, string[]>;
    };
    expect(body.username).toBe('max.mustermann');
    expect(body.attributes).toEqual({ locale: ['de'], teams: ['alpha', 'beta'] });
  });

  it('deactivates users by sending enabled=false', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createTextResponse(204, ''),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    await expect(client.deactivateUser('user-7')).resolves.toBeUndefined();

    const requestCall = calls.find((entry) => String(entry.input).includes('/users/user-7'));
    expect(requestCall?.init?.method).toBe('PUT');
    expect(JSON.parse(String(requestCall?.init?.body))).toEqual({ enabled: false });
  });

  it('fails syncRoles when expected roles are unknown in Keycloak', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(200, []),
      createJsonResponse(200, [{ id: 'role-editor', name: 'editor' }]),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    await expect(client.syncRoles('user-1', ['missing-role'])).rejects.toMatchObject({
      code: 'unknown_role',
      statusCode: 400,
    });
  });

  it('throws when listUsers is called with an open circuit and no fallback', async () => {
    let nowMs = 0;
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      now: () => nowMs,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 5,
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.listRoles()).rejects.toBeInstanceOf(KeycloakAdminRequestError);
    }

    await expect(client.listUsers()).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);
    nowMs += 1;
  });

  it('surfaces token responses without access_token', async () => {
    const { fetchImpl } = createFetchStub([createJsonResponse(200, { expires_in: 120 })]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    await expect(client.listRoles()).rejects.toMatchObject({
      code: 'token_missing',
      statusCode: 502,
    });
  });

  it('returns null from getRoleByName when Keycloak responds with 404', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(404, { error: 'not_found' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    await expect(client.getRoleByName('missing-role')).resolves.toBeNull();
  });

  it('blocks getRoleByName when the circuit breaker is open', async () => {
    let nowMs = 0;
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      now: () => nowMs,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 5,
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.getRoleByName(`role-${i}`)).rejects.toBeInstanceOf(KeycloakAdminRequestError);
    }

    await expect(client.getRoleByName('role-open')).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);
    nowMs += 1;
  });

  it('creates realm roles and reads the created role back', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createTextResponse(201, ''),
      createJsonResponse(200, {
        id: 'role-created',
        name: 'custom_editor',
        description: 'Custom Editor',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['instance-1'],
          role_key: ['custom_editor'],
          display_name: ['Custom Editor'],
        },
        composite: false,
        clientRole: false,
        containerId: 'realm-1',
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    const created = await client.createRole({
      externalName: 'custom_editor',
      description: 'Custom Editor',
      attributes: {
        managedBy: 'studio',
        instanceId: 'instance-1',
        roleKey: 'custom_editor',
        displayName: 'Custom Editor',
      },
    });

    expect(created).toEqual({
      id: 'role-created',
      externalName: 'custom_editor',
      description: 'Custom Editor',
      attributes: {
        managed_by: ['studio'],
        instance_id: ['instance-1'],
        role_key: ['custom_editor'],
        display_name: ['Custom Editor'],
      },
      composite: false,
      clientRole: false,
      containerId: 'realm-1',
    });

    const createCall = calls.find(
      (entry) =>
        String(entry.input).includes('/admin/realms/demo/roles') &&
        entry.init?.method === 'POST'
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      name: 'custom_editor',
      description: 'Custom Editor',
      attributes: {
        managed_by: ['studio'],
        instance_id: ['instance-1'],
        role_key: ['custom_editor'],
        display_name: ['Custom Editor'],
      },
    });
  });

  it('adopts an already existing compatible realm role during createRole', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(409, { errorMessage: 'Role exists' }),
      createJsonResponse(200, {
        id: 'role-existing',
        name: 'custom_editor',
        description: 'Legacy description',
        attributes: {
          managed_by: ['external'],
        },
      }),
      createTextResponse(204, ''),
      createJsonResponse(200, {
        id: 'role-existing',
        name: 'custom_editor',
        description: 'Custom Editor',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['instance-1'],
          role_key: ['custom_editor'],
          display_name: ['Custom Editor'],
        },
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    const created = await client.createRole({
      externalName: 'custom_editor',
      description: 'Custom Editor',
      attributes: {
        managedBy: 'studio',
        instanceId: 'instance-1',
        roleKey: 'custom_editor',
        displayName: 'Custom Editor',
      },
    });

    expect(created).toEqual({
      id: 'role-existing',
      externalName: 'custom_editor',
      description: 'Custom Editor',
      attributes: {
        managed_by: ['studio'],
        instance_id: ['instance-1'],
        role_key: ['custom_editor'],
        display_name: ['Custom Editor'],
      },
      composite: undefined,
      clientRole: undefined,
      containerId: undefined,
    });

    const updateCall = calls.find(
      (entry) =>
        String(entry.input).includes('/admin/realms/demo/roles/custom_editor') &&
        entry.init?.method === 'PUT'
    );
    expect(updateCall).toBeDefined();
    expect(JSON.parse(String(updateCall?.init?.body))).toEqual({
      name: 'custom_editor',
      description: 'Custom Editor',
      attributes: {
        managed_by: ['studio'],
        instance_id: ['instance-1'],
        role_key: ['custom_editor'],
        display_name: ['Custom Editor'],
      },
    });
  });

  it('preserves conflict semantics for studio-managed roles from another instance', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(409, { errorMessage: 'Role exists' }),
      createJsonResponse(200, {
        id: 'role-other-instance',
        name: 'custom_editor',
        description: 'Custom Editor',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['instance-2'],
          role_key: ['custom_editor'],
          display_name: ['Custom Editor'],
        },
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    await expect(
      client.createRole({
        externalName: 'custom_editor',
        description: 'Custom Editor',
        attributes: {
          managedBy: 'studio',
          instanceId: 'instance-1',
          roleKey: 'custom_editor',
          displayName: 'Custom Editor',
        },
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Keycloak create_role failed: Role exists',
    });
  });

  it('fails createRole when post-create lookup returns no role', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createTextResponse(201, ''),
      createJsonResponse(404, { error: 'not_found' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    await expect(
      client.createRole({
        externalName: 'custom_editor',
        attributes: {
          managedBy: 'studio',
          instanceId: 'instance-1',
          roleKey: 'custom_editor',
          displayName: 'Custom Editor',
        },
      })
    ).rejects.toMatchObject({
      code: 'role_lookup_failed',
      statusCode: 502,
    });
  });

  it('updates realm roles and reads the updated role back', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createTextResponse(204, ''),
      createJsonResponse(200, {
        id: 'role-updated',
        name: 'custom_editor',
        description: 'Updated Custom Editor',
        attributes: {
          managed_by: ['studio'],
          instance_id: ['instance-1'],
          role_key: ['custom_editor'],
          display_name: ['Updated Custom Editor'],
        },
        composite: false,
        clientRole: false,
        containerId: 'realm-1',
      }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    const updated = await client.updateRole('custom_editor', {
      description: 'Updated Custom Editor',
      attributes: {
        managedBy: 'studio',
        instanceId: 'instance-1',
        roleKey: 'custom_editor',
        displayName: 'Updated Custom Editor',
      },
    });

    expect(updated).toEqual(
      expect.objectContaining({
        id: 'role-updated',
        externalName: 'custom_editor',
        description: 'Updated Custom Editor',
      })
    );

    const updateCall = calls.find(
      (entry) =>
        String(entry.input).includes('/admin/realms/demo/roles/custom_editor') &&
        entry.init?.method === 'PUT'
    );
    expect(updateCall).toBeDefined();
    expect(JSON.parse(String(updateCall?.init?.body))).toEqual({
      name: 'custom_editor',
      description: 'Updated Custom Editor',
      attributes: {
        managed_by: ['studio'],
        instance_id: ['instance-1'],
        role_key: ['custom_editor'],
        display_name: ['Updated Custom Editor'],
      },
    });
  });

  it('fails updateRole when post-update lookup returns no role', async () => {
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createTextResponse(204, ''),
      createJsonResponse(404, { error: 'not_found' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      maxRetries: 0,
    });

    await expect(
      client.updateRole('custom_editor', {
        attributes: {
          managedBy: 'studio',
          instanceId: 'instance-1',
          roleKey: 'custom_editor',
          displayName: 'Custom Editor',
        },
      })
    ).rejects.toMatchObject({
      code: 'role_lookup_failed',
      statusCode: 502,
    });
  });

  it('deletes realm roles via DELETE endpoint', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createTextResponse(204, ''),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    await expect(client.deleteRole('custom_editor')).resolves.toBeUndefined();

    const deleteCall = calls.find(
      (entry) =>
        String(entry.input).includes('/admin/realms/demo/roles/custom_editor') &&
        entry.init?.method === 'DELETE'
    );
    expect(deleteCall).toBeDefined();
  });

  it('syncs realm roles by adding missing and removing stale roles', async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(200, [{ id: 'role-editor', name: 'editor' }]),
      createJsonResponse(200, [
        { id: 'role-editor', name: 'editor' },
        { id: 'role-reviewer', name: 'reviewer' },
      ]),
      createTextResponse(204, ''),
      createTextResponse(204, ''),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    await client.syncRoles('user-1', ['reviewer']);

    const addCall = calls.find((entry) =>
      String(entry.input).includes('/users/user-1/role-mappings/realm') && entry.init?.method === 'POST'
    );
    const removeCall = calls.find((entry) =>
      String(entry.input).includes('/users/user-1/role-mappings/realm') && entry.init?.method === 'DELETE'
    );

    expect(addCall).toBeDefined();
    expect(removeCall).toBeDefined();
  });

  it("lists a user's mapped realm role names", async () => {
    const { fetchImpl, calls } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(200, [
        { id: 'role-editor', name: 'editor' },
        { id: 'role-admin', name: 'system_admin' },
      ]),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
    });

    await expect(client.listUserRoleNames('user-1')).resolves.toEqual(['editor', 'system_admin']);
    expect(
      calls.some(
        (entry) =>
          String(entry.input).includes('/admin/realms/demo/users/user-1/role-mappings/realm') &&
          entry.init?.method === 'GET'
      )
    ).toBe(true);
  });

  it('blocks listUserRoleNames when the circuit breaker is open', async () => {
    let nowMs = 0;
    const { fetchImpl } = createFetchStub([
      createJsonResponse(200, { access_token: 'token-1', expires_in: 120 }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
      createJsonResponse(503, { error: 'service_unavailable' }),
    ]);

    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
      fetchImpl,
      now: () => nowMs,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 5,
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.listRoles()).rejects.toBeInstanceOf(KeycloakAdminRequestError);
    }

    await expect(client.listUserRoleNames('user-open')).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);
    nowMs += 1;
  });
});

describe('getKeycloakAdminClientConfigFromEnv', () => {
  it('reads required keycloak admin variables from environment', () => {
    process.env.KEYCLOAK_ADMIN_BASE_URL = 'https://keycloak.example.com';
    process.env.KEYCLOAK_ADMIN_REALM = 'demo';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'svc-client';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'svc-secret';

    expect(getKeycloakAdminClientConfigFromEnv()).toEqual({
      baseUrl: 'https://keycloak.example.com',
      realm: 'demo',
      clientId: 'svc-client',
      clientSecret: 'svc-secret',
    });
  });

  it('throws for missing environment variables', () => {
    delete process.env.KEYCLOAK_ADMIN_BASE_URL;
    process.env.KEYCLOAK_ADMIN_REALM = 'demo';
    process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'svc-client';
    process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'svc-secret';

    expect(() => getKeycloakAdminClientConfigFromEnv()).toThrow('Missing required env: KEYCLOAK_ADMIN_BASE_URL');
  });
});
