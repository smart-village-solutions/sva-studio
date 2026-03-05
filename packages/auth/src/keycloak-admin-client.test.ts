import { describe, expect, it } from 'vitest';

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
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
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
    expect(users).toEqual([{ id: 'db-fallback-user' }]);
    nowMs += 1;
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
});
