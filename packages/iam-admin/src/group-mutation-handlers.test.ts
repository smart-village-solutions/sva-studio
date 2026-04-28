import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGroupMutationHandlers, type GroupMutationHandlerDeps } from './group-mutation-handlers.js';

const groupId = '550e8400-e29b-41d4-a716-446655440000';

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-admin-1',
    instanceId: 'inst-g',
    roles: ['system_admin'],
  },
};

const actor = {
  instanceId: 'inst-g',
  actorAccountId: 'account-admin',
  requestId: 'req-groups',
  traceId: 'trace-groups',
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type QueryResult = {
  readonly rowCount: number;
  readonly rows: readonly unknown[];
};

const createDeps = (
  queryResults: QueryResult[] = [{ rowCount: 1, rows: [{ id: groupId }] }],
  overrides: Partial<GroupMutationHandlerDeps> = {}
) => {
  const query = vi.fn(async () => {
    const result = queryResults.shift() ?? { rowCount: 1, rows: [{ id: groupId }] };
    return { rowCount: result.rowCount, rows: [...result.rows] };
  });

  return {
    asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
    createApiError: vi.fn((status, code, message, requestId, details) =>
      createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
    ),
    emitActivityLog: vi.fn(async () => undefined),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'req-workspace', traceId: 'trace-workspace' })),
    isUuid: vi.fn(() => true),
    jsonResponse: vi.fn(createJsonResponse),
    logger: {
      error: vi.fn(),
      info: vi.fn(),
    },
    parseRequestBody: vi.fn(async () => ({
      ok: true as const,
      data: {
        groupKey: 'admins',
        displayName: 'Admins',
        groupType: 'role_bundle' as const,
        isActive: true,
        roleId: groupId,
        keycloakSubject: 'kc-user-1',
      },
    })),
    publishGroupEvent: vi.fn(async () => undefined),
    randomUUID: vi.fn(() => groupId),
    readPathSegment: vi.fn((_request, index) => (index === 6 ? groupId : groupId)),
    requireRoles: vi.fn(() => null),
    resolveActorInfo: vi.fn(async () => ({ actor })),
    validateCsrf: vi.fn(() => null),
    withInstanceScopedDb: vi.fn(async (_instanceId, work) => work({ query })),
    ...overrides,
  } satisfies GroupMutationHandlerDeps;
};

describe('createGroupMutationHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates groups and writes an activity log', async () => {
    const deps = createDeps();
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.createGroupInternal(
      new Request('http://localhost/api/v1/iam/inst-g/groups', { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ data: { id: groupId }, requestId: 'req-groups' });
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'iam_group_created',
        payload: { group_id: groupId, group_key: 'admins' },
      })
    );
  });

  it('maps groups_type_chk violations to invalid_request', async () => {
    const deps = createDeps([], {
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('new row for relation "groups" violates check constraint "groups_type_chk"');
      }),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.createGroupInternal(
      new Request('http://localhost/api/v1/iam/inst-g/groups', { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', message: 'Ungültiger Gruppentyp.' },
    });
  });

  it('returns 400 when an update contains no changes', async () => {
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({ ok: true as const, data: {} })),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.updateGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}`, { method: 'PATCH', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('deletes groups and publishes affected membership invalidations', async () => {
    const deps = createDeps([
      {
        rowCount: 1,
        rows: [
          {
            account_id: 'account-1',
            keycloak_subject: 'kc-user-1',
          },
        ],
      },
      { rowCount: 1, rows: [{ id: groupId }] },
    ]);
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.deleteGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}`, { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.publishGroupEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'GroupDeleted',
        affectedAccountIds: ['account-1'],
        affectedKeycloakSubjects: ['kc-user-1'],
      })
    );
  });

  it('returns not found when membership assignment cannot resolve the account', async () => {
    const deps = createDeps([{ rowCount: 0, rows: [] }]);
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.assignGroupMembershipInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/members`, { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', message: 'Benutzer nicht gefunden' },
    });
  });
});
