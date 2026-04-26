import type { IamUserDetail, IamUserListItem, IamUserTimelineEvent } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createUserReadHandlers, type UserReadHandlerDeps } from './user-read-handlers.js';

const userListItem = {
  id: '11111111-1111-1111-8111-111111111111',
  keycloakSubject: 'kc-user-1',
  displayName: 'Alice Example',
  email: 'alice@example.com',
  status: 'active',
  roles: [],
} satisfies IamUserListItem;

const userDetail = {
  ...userListItem,
  username: 'alice',
  firstName: 'Alice',
  lastName: 'Example',
  mainserverUserApplicationSecretSet: false,
} satisfies IamUserDetail;

const timelineEvent = {
  id: 'event-1',
  category: 'iam',
  eventType: 'created',
  title: 'created',
  description: 'created',
  occurredAt: '2026-01-01T00:00:00.000Z',
  perspective: 'actor',
  metadata: {},
} satisfies IamUserTimelineEvent;

const createApiErrorResponse = (
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: Readonly<Record<string, unknown>>
) =>
  new Response(JSON.stringify({ error: { code, message, ...(details ? { details } : {}) }, requestId }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const createDeps = (overrides: Partial<UserReadHandlerDeps> = {}): UserReadHandlerDeps => ({
  applyCanonicalUserDetailProjection: vi.fn(async (input) => ({
    ...input.user,
    roles: [{ roleId: 'role-1', roleKey: 'admin', roleName: 'Admin', roleLevel: 100 }],
    mainserverUserApplicationId: input.mainserverCredentialState?.mainserverUserApplicationId,
    mainserverUserApplicationSecretSet:
      input.mainserverCredentialState?.mainserverUserApplicationSecretSet ?? false,
  })),
  applyCanonicalUserListProjection: vi.fn(async (input) =>
    input.users.map((user) => ({
      ...user,
      roles: [{ roleId: 'role-1', roleKey: 'admin', roleName: 'Admin', roleLevel: 100 }],
    }))
  ),
  asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
  asApiList: vi.fn((data, pagination, requestId) => ({ data, pagination, ...(requestId ? { requestId } : {}) })),
  consumeRateLimit: vi.fn(() => null),
  createApiError: vi.fn(createApiErrorResponse),
  createDatabaseApiError: vi.fn((error, requestId) =>
    createApiErrorResponse(500, 'database_unavailable', error instanceof Error ? error.message : 'failed', requestId)
  ),
  jsonResponse: vi.fn((status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  ),
  listPlatformUsersInternal: vi.fn(async () =>
    new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
  ),
  logUserProjectionDegraded: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  readPage: vi.fn(() => ({ page: 1, pageSize: 10 })),
  readString: vi.fn((value) => value ?? undefined),
  readValidatedUserId: vi.fn(() => ({ userId: userDetail.id })),
  resolveKeycloakRoleNames: vi.fn(async () => ['admin']),
  resolveProjectedMainserverCredentialState: vi.fn(async () => ({
    mainserverUserApplicationId: 'app-1',
    mainserverUserApplicationSecretSet: true,
  })),
  resolveTenantKeycloakUsersWithPagination: vi.fn(async () => ({
    users: [userListItem],
    total: 1,
    keycloakRoleNamesBySubject: new Map([[userListItem.keycloakSubject, ['admin']]]),
  })),
  resolveUserDetail: vi.fn(async () => userDetail),
  resolveUserReadAccess: vi.fn(async () => ({
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-users',
      traceId: 'trace-users',
    },
  })),
  resolveUserTimeline: vi.fn(async () => [timelineEvent]),
  withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
    work({
      query: vi.fn(),
    })
  ),
  ...overrides,
});

const tenantContext = {
  sessionId: 'session-1',
  user: {
    id: 'kc-actor-1',
    instanceId: 'de-musterhausen',
    roles: ['system_admin'],
  },
};

describe('createUserReadHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tenant users through access, rate-limit, Keycloak pagination and canonical projection', async () => {
    const deps = createDeps();
    const handlers = createUserReadHandlers(deps);

    const response = await handlers.listUsersInternal(
      new Request('http://localhost/api/v1/iam/users?status=active&role=admin&search=alice'),
      tenantContext
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: userListItem.id,
          roles: [{ roleKey: 'admin' }],
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1 },
      requestId: 'req-users',
    });
    expect(deps.resolveUserReadAccess).toHaveBeenCalled();
    expect(deps.consumeRateLimit).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'kc-actor-1',
      scope: 'read',
      requestId: 'req-users',
    });
    expect(deps.resolveTenantKeycloakUsersWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-musterhausen',
        page: 1,
        pageSize: 10,
        status: 'active',
        role: 'admin',
        search: 'alice',
      })
    );
    expect(deps.applyCanonicalUserListProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        keycloakRoleNamesBySubject: new Map([[userListItem.keycloakSubject, ['admin']]]),
      })
    );
  });

  it('delegates platform user lists when the context has no instance', async () => {
    const deps = createDeps();
    const handlers = createUserReadHandlers(deps);
    const platformContext = {
      sessionId: 'session-1',
      user: { id: 'kc-platform-admin', roles: ['system_admin'] },
    };
    const request = new Request('http://localhost/api/v1/iam/users');

    const response = await handlers.listUsersInternal(request, platformContext);

    expect(response.status).toBe(200);
    expect(deps.listPlatformUsersInternal).toHaveBeenCalledWith(request, platformContext);
    expect(deps.resolveUserReadAccess).not.toHaveBeenCalled();
  });

  it('rejects invalid tenant user status filters', async () => {
    const deps = createDeps();
    const handlers = createUserReadHandlers(deps);

    const response = await handlers.listUsersInternal(
      new Request('http://localhost/api/v1/iam/users?status=unknown'),
      tenantContext
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', message: 'Ungültiger Status-Filter.' },
      requestId: 'req-users',
    });
    expect(deps.resolveTenantKeycloakUsersWithPagination).not.toHaveBeenCalled();
  });

  it('returns projected user details and logs degraded external projections', async () => {
    const deps = createDeps({
      resolveKeycloakRoleNames: vi.fn(async () => {
        throw new Error('keycloak unavailable');
      }),
    });
    const handlers = createUserReadHandlers(deps);

    const response = await handlers.getUserInternal(
      new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`),
      tenantContext
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: userDetail.id,
        roles: [{ roleKey: 'admin' }],
        mainserverUserApplicationSecretSet: true,
      },
      requestId: 'req-users',
    });
    expect(deps.logUserProjectionDegraded).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ instanceId: 'de-musterhausen' }),
        userId: userDetail.id,
        keycloakRoleNamesResult: expect.objectContaining({ status: 'rejected' }),
      })
    );
    expect(deps.applyCanonicalUserDetailProjection).toHaveBeenCalledWith(
      expect.objectContaining({
        keycloakRoleNames: null,
        mainserverCredentialState: {
          mainserverUserApplicationId: 'app-1',
          mainserverUserApplicationSecretSet: true,
        },
      })
    );
  });

  it('returns 404 when the requested user does not exist', async () => {
    const deps = createDeps({
      resolveUserDetail: vi.fn(async () => null),
    });
    const handlers = createUserReadHandlers(deps);

    const response = await handlers.getUserInternal(
      new Request(`http://localhost/api/v1/iam/users/${userDetail.id}`),
      tenantContext
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found', message: 'Nutzer nicht gefunden.' },
      requestId: 'req-users',
    });
  });

  it('returns the user timeline as an API list', async () => {
    const deps = createDeps();
    const handlers = createUserReadHandlers(deps);

    const response = await handlers.getUserTimelineInternal(
      new Request(`http://localhost/api/v1/iam/users/${userDetail.id}/timeline`),
      tenantContext
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [timelineEvent],
      pagination: { page: 1, pageSize: 1, total: 1 },
      requestId: 'req-users',
    });
  });

  it('maps timeline database failures to database_unavailable', async () => {
    const deps = createDeps({
      resolveUserTimeline: vi.fn(async () => {
        throw new Error('database down');
      }),
    });
    const handlers = createUserReadHandlers(deps);

    const response = await handlers.getUserTimelineInternal(
      new Request(`http://localhost/api/v1/iam/users/${userDetail.id}/timeline`),
      tenantContext
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'database_unavailable', message: 'IAM-Historie ist nicht erreichbar.' },
      requestId: 'req-users',
    });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'IAM user timeline failed',
      expect.objectContaining({
        operation: 'get_user_timeline',
        instance_id: 'de-musterhausen',
      })
    );
  });
});
