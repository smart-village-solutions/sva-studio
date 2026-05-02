import { describe, expect, it, vi } from 'vitest';

import { KeycloakAdminClient, KeycloakAdminRequestError, KeycloakAdminUnavailableError } from './core.js';

type RecordedRequest = {
  readonly body?: string;
  readonly method: string;
  readonly path: string;
};

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

const noContentResponse = (): Response => new Response(null, { status: 204 });

const createFetchMock = () => {
  const requests: RecordedRequest[] = [];

  const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = `${url.pathname}${url.search}`;
    requests.push({
      method,
      path,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });

    if (path === '/realms/master/protocol/openid-connect/token') {
      return jsonResponse({ access_token: 'token-a', expires_in: 300 });
    }

    if (method === 'POST' && path === '/admin/realms/tenant/users') {
      return new Response(null, {
        status: 201,
        headers: { location: 'https://keycloak.example.test/admin/realms/tenant/users/user-created' },
      });
    }

    if (method === 'GET' && path.startsWith('/admin/realms/tenant/users/count')) {
      return jsonResponse(7);
    }

    if (method === 'GET' && path === '/admin/realms/tenant/users/user-1') {
      return jsonResponse({
        id: 'user-1',
        username: 'user-a',
        email: 'user-a@example.test',
        attributes: {
          instanceId: ['tenant'],
          locale: ['de'],
        },
      });
    }

    if (method === 'GET' && path.includes('/users?exact=true&username=')) {
      return jsonResponse([{ id: 'user-1', username: 'user-a' }]);
    }

    if (method === 'GET' && path.includes('/users?exact=true&email=')) {
      return jsonResponse([{ id: 'user-1', email: 'USER-A@example.test' }]);
    }

    if (method === 'GET' && path.startsWith('/admin/realms/tenant/users?')) {
      return jsonResponse([
        {
          id: 'user-1',
          username: 'user-a',
          email: 'user-a@example.test',
          firstName: 'User',
          lastName: 'A',
          enabled: true,
          attributes: { locale: ['de'] },
        },
      ]);
    }

    if (method === 'GET' && path === '/admin/realms/tenant/users/user-1/role-mappings/realm') {
      return jsonResponse([
        { id: 'role-offline', name: 'offline_access' },
        {
          id: 'role-old',
          name: 'old-role',
          attributes: { managed_by: ['studio'], instance_id: ['tenant'] },
        },
      ]);
    }

    if (method === 'GET' && path.startsWith('/admin/realms/tenant/roles/count')) {
      return jsonResponse({ count: 3 });
    }

    if (
      method === 'GET' &&
      (path === '/admin/realms/tenant/roles' || path.startsWith('/admin/realms/tenant/roles?'))
    ) {
      return jsonResponse([
        {
          id: 'role-admin',
          name: 'admin',
          description: 'Admin',
          attributes: { managed_by: ['studio'], instance_id: ['tenant'] },
        },
        {
          id: 'role-old',
          name: 'old-role',
          attributes: { managed_by: ['studio'], instance_id: ['tenant'] },
        },
      ]);
    }

    if (method === 'GET' && path === '/admin/realms/tenant/roles/admin') {
      return jsonResponse({
        id: 'role-admin',
        name: 'admin',
        description: 'Admin',
        attributes: { managed_by: ['studio'], instance_id: ['tenant'] },
      });
    }

    if (method === 'GET' && path === '/admin/realms/tenant/roles/missing') {
      return jsonResponse({ error: 'not_found' }, { status: 404 });
    }

    if (method === 'GET' && path === '/admin/realms/tenant') {
      return jsonResponse({ realm: 'tenant' });
    }

    if (method === 'GET' && path === '/admin/realms/tenant/clients?clientId=studio') {
      return jsonResponse([]);
    }

    if (method === 'GET' && path === '/admin/realms/tenant/clients?clientId=studio-existing') {
      return jsonResponse([
        {
          id: 'client-1',
          clientId: 'studio-existing',
          rootUrl: 'https://old.example.test',
          redirectUris: ['https://old.example.test/callback'],
          webOrigins: ['https://old.example.test'],
          attributes: { 'post.logout.redirect.uris': 'https://old.example.test/logout' },
        },
      ]);
    }

    if (method === 'GET' && path === '/admin/realms/tenant/clients/client-1/client-secret') {
      return jsonResponse({ value: 'old-secret' });
    }

    if (
      method === 'GET' &&
      path === '/admin/realms/tenant/clients/client-1/protocol-mappers/models'
    ) {
      return jsonResponse([
        {
          id: 'mapper-1',
          name: 'instanceId',
          protocol: 'openid-connect',
          protocolMapper: 'oidc-usermodel-attribute-mapper',
          config: { 'claim.name': 'oldInstanceId' },
        },
      ]);
    }

    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      return noContentResponse();
    }

    return jsonResponse({ errorMessage: `Unhandled ${method} ${path}` }, { status: 500 });
  });

  return { fetchImpl, requests };
};

const createClient = (fetchImpl: ReturnType<typeof createFetchMock>['fetchImpl']) =>
  new KeycloakAdminClient({
    baseUrl: 'https://keycloak.example.test/',
    realm: 'tenant',
    adminRealm: 'master',
    clientId: 'studio-admin',
    clientSecret: 'secret',
    connectTimeoutMs: 0,
    readTimeoutMs: 0,
    maxRetries: 0,
    fetchImpl,
    now: () => 1_000,
    sleep: async () => undefined,
  });

describe('KeycloakAdminClient', () => {
  it('maps read operations and reuses the cached access token', async () => {
    const { fetchImpl, requests } = createFetchMock();
    const client = createClient(fetchImpl);

    await expect(client.listUsers({ first: 0, max: 10, enabled: true, search: 'user' })).resolves.toEqual([
      expect.objectContaining({
        externalId: 'user-1',
        username: 'user-a',
        attributes: { locale: ['de'] },
      }),
    ]);
    await expect(client.countUsers({ enabled: true, email: 'user-a@example.test' })).resolves.toBe(7);
    await expect(client.getUserAttributes('user-1', ['locale'])).resolves.toEqual({ locale: ['de'] });
    await expect(client.findUserByUsername('user-a')).resolves.toMatchObject({ id: 'user-1' });
    await expect(client.findUserByEmail('user-a@example.test')).resolves.toMatchObject({ id: 'user-1' });
    await expect(client.listRoles({ first: 0, max: 20, search: 'admin' })).resolves.toEqual([
      expect.objectContaining({ externalName: 'admin', id: 'role-admin' }),
      expect.objectContaining({ externalName: 'old-role', id: 'role-old' }),
    ]);
    await expect(client.countRoles({ search: 'admin' })).resolves.toBe(3);
    await expect(client.getRoleByName('admin')).resolves.toMatchObject({ externalName: 'admin' });
    await expect(client.getRoleByName('missing')).resolves.toBeNull();
    await expect(client.getRealm()).resolves.toEqual({ realm: 'tenant' });

    expect(requests.filter((request) => request.path.includes('/protocol/openid-connect/token'))).toHaveLength(1);
  });

  it('performs write operations with mapped payloads', async () => {
    const { fetchImpl, requests } = createFetchMock();
    const client = createClient(fetchImpl);

    await expect(
      client.createUser({
        username: 'created',
        email: 'created@example.test',
        firstName: 'Created',
        lastName: 'User',
        attributes: { locale: 'de' },
      })
    ).resolves.toEqual({ externalId: 'user-created' });
    await expect(client.updateUser('user-1', { enabled: false, attributes: { locale: ['en'] } })).resolves.toBeUndefined();
    await expect(client.deactivateUser('user-1')).resolves.toBeUndefined();
    await expect(client.syncRoles('user-1', ['admin'])).resolves.toBeUndefined();
    await expect(client.assignRealmRoles('user-1', ['admin', 'admin'])).resolves.toBeUndefined();
    await expect(client.removeRealmRoles('user-1', ['old-role'])).resolves.toBeUndefined();
    await expect(client.logoutUser('user-1')).resolves.toBeUndefined();
    await expect(client.setUserPassword('user-1', 'secret-password', false)).resolves.toBeUndefined();
    await expect(client.setUserRequiredActions('user-1', ['UPDATE_PASSWORD'])).resolves.toBeUndefined();
    await expect(client.ensureRealm({ displayName: 'Tenant' })).resolves.toBeUndefined();
    await expect(
      client.createRole({
        externalName: 'admin',
        description: 'Admin',
        attributes: {
          managedBy: 'studio',
          instanceId: 'tenant',
          roleKey: 'admin',
          displayName: 'Admin',
        },
      })
    ).resolves.toMatchObject({ externalName: 'admin' });
    await expect(client.deleteRole('admin')).resolves.toBeUndefined();

    expect(
      requests.some(
        (request) =>
          request.method === 'DELETE' &&
          request.path === '/admin/realms/tenant/users/user-1/role-mappings/realm' &&
          request.body?.includes('old-role')
      )
    ).toBe(true);
  });

  it('creates and updates OIDC clients and protocol mappers', async () => {
    const { fetchImpl, requests } = createFetchMock();
    const client = createClient(fetchImpl);

    await expect(
      client.ensureOidcClient({
        clientId: 'studio',
        redirectUris: ['https://studio.example.test/callback'],
        postLogoutRedirectUris: ['https://studio.example.test/logout'],
        webOrigins: ['https://studio.example.test'],
        rootUrl: 'https://studio.example.test',
      })
    ).resolves.toBeUndefined();

    await expect(
      client.ensureOidcClient({
        clientId: 'studio-existing',
        redirectUris: ['https://studio.example.test/callback'],
        postLogoutRedirectUris: ['https://studio.example.test/logout'],
        webOrigins: ['https://studio.example.test'],
        rootUrl: 'https://studio.example.test',
        clientSecret: 'new-secret',
      })
    ).resolves.toBeUndefined();

    await expect(client.listClientProtocolMappers('studio-existing')).resolves.toEqual([
      expect.objectContaining({ id: 'mapper-1', name: 'instanceId' }),
    ]);
    await expect(
      client.ensureUserAttributeProtocolMapper({
        clientId: 'studio-existing',
        name: 'instanceId',
        userAttribute: 'instanceId',
        claimName: 'instanceId',
      })
    ).resolves.toBeUndefined();

    expect(requests.some((request) => request.method === 'POST' && request.path === '/admin/realms/tenant/clients')).toBe(true);
    expect(
      requests.some(
        (request) =>
          request.method === 'POST' &&
          request.path === '/admin/realms/tenant/clients/client-1/client-secret' &&
          request.body?.includes('new-secret')
      )
    ).toBe(true);
    expect(
      requests.some(
        (request) =>
          request.method === 'PUT' &&
          request.path === '/admin/realms/tenant/clients/client-1/protocol-mappers/models/mapper-1'
      )
    ).toBe(true);
  });

  it('opens the circuit breaker after retryable failures', async () => {
    const fetchImpl = vi.fn(async (input: string | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/protocol/openid-connect/token')) {
        return jsonResponse({ access_token: 'token-a', expires_in: 300 });
      }
      return jsonResponse({ errorMessage: 'temporary outage' }, { status: 503 });
    });
    let now = 1_000;
    const client = new KeycloakAdminClient({
      baseUrl: 'https://keycloak.example.test',
      realm: 'tenant',
      adminRealm: 'master',
      clientId: 'studio-admin',
      clientSecret: 'secret',
      connectTimeoutMs: 0,
      readTimeoutMs: 0,
      maxRetries: 0,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerOpenMs: 10_000,
      fetchImpl,
      now: () => now,
      sleep: async () => undefined,
    });

    await expect(client.listUsers()).rejects.toMatchObject({
      statusCode: 503,
      code: 'http_503',
    });
    expect(client.getCircuitBreakerState()).toBe(2);
    await expect(client.listUsers()).rejects.toBeInstanceOf(KeycloakAdminUnavailableError);

    now = 20_000;
    await expect(client.listUsers()).rejects.toBeInstanceOf(KeycloakAdminRequestError);
  });

  it('fails user creation when Keycloak omits the location header', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/protocol/openid-connect/token')) {
        return jsonResponse({ access_token: 'token-a', expires_in: 300 });
      }
      if (init?.method === 'POST' && url.pathname === '/admin/realms/tenant/users') {
        return new Response(null, { status: 201 });
      }
      return jsonResponse({ errorMessage: 'Unhandled request' }, { status: 500 });
    });
    const client = createClient(fetchImpl);

    await expect(
      client.createUser({
        email: 'created@example.test',
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'missing_location_header',
    });
  });

  it('maps object-shaped role count responses and missing realms correctly', async () => {
    const fetchImpl = vi.fn(async (input: string | URL): Promise<Response> => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/protocol/openid-connect/token')) {
        return jsonResponse({ access_token: 'token-a', expires_in: 300 });
      }
      if (path === '/admin/realms/tenant/roles/count') {
        return jsonResponse({ count: 9 });
      }
      if (path === '/admin/realms/tenant') {
        return jsonResponse({ error: 'not_found' }, { status: 404 });
      }
      return jsonResponse({ errorMessage: 'Unhandled request' }, { status: 500 });
    });
    const client = createClient(fetchImpl);

    await expect(client.countRoles()).resolves.toBe(9);
    await expect(client.getRealm()).resolves.toBeNull();
  });

  it('creates a protocol mapper when none exists yet', async () => {
    const requests: RecordedRequest[] = [];
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      const path = `${url.pathname}${url.search}`;
      requests.push({
        method,
        path,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      if (path === '/realms/master/protocol/openid-connect/token') {
        return jsonResponse({ access_token: 'token-a', expires_in: 300 });
      }
      if (method === 'GET' && path === '/admin/realms/tenant/clients?clientId=studio') {
        return jsonResponse([
          {
            id: 'client-1',
            clientId: 'studio',
          },
        ]);
      }
      if (
        method === 'GET' &&
        path === '/admin/realms/tenant/clients/client-1/protocol-mappers/models'
      ) {
        return jsonResponse([]);
      }
      if (method === 'POST') {
        return noContentResponse();
      }
      return jsonResponse({ errorMessage: `Unhandled ${method} ${path}` }, { status: 500 });
    });
    const client = createClient(fetchImpl);

    await expect(
      client.ensureUserAttributeProtocolMapper({
        clientId: 'studio',
        name: 'instanceId',
        userAttribute: 'instanceId',
        claimName: 'instanceId',
      })
    ).resolves.toBeUndefined();

    expect(
      requests.some(
        (request) =>
          request.method === 'POST' &&
          request.path === '/admin/realms/tenant/clients/client-1/protocol-mappers/models' &&
          request.body?.includes('"claim.name":"instanceId"')
      )
    ).toBe(true);
  });

  it('returns null for missing client secrets and ignores realm conflicts', async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      const path = `${url.pathname}${url.search}`;
      if (path === '/realms/master/protocol/openid-connect/token') {
        return jsonResponse({ access_token: 'token-a', expires_in: 300 });
      }
      if (method === 'POST' && path === '/admin/realms') {
        return jsonResponse({ errorMessage: 'already exists' }, { status: 409 });
      }
      if (method === 'GET' && path === '/admin/realms/tenant/clients?clientId=missing-client') {
        return jsonResponse([]);
      }
      return jsonResponse({ errorMessage: `Unhandled ${method} ${path}` }, { status: 500 });
    });
    const client = createClient(fetchImpl);

    await expect(client.ensureRealm({ displayName: 'Tenant' })).resolves.toBeUndefined();
    await expect(client.getOidcClientSecretValue('missing-client')).resolves.toBeNull();
  });
});
