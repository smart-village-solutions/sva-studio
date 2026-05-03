import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createGroupReadHandlers, type GroupReadHandlerDeps } from './group-read-handlers.js';

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
  requestId: 'req-groups',
  traceId: 'trace-groups',
};

const groupRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  instance_id: 'inst-g',
  group_key: 'admins',
  display_name: 'Admins',
  description: null,
  group_type: 'role_bundle',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  member_count: 2,
  role_count: 1,
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type QueryResult = {
  readonly rowCount: number;
  readonly rows: readonly unknown[];
};

const createDeps = (
  queryResults: QueryResult[] = [{ rowCount: 1, rows: [groupRow] }],
  overrides: Partial<GroupReadHandlerDeps> = {}
) => {
  const query = vi.fn(async () => {
    const result = queryResults.shift() ?? { rowCount: 0, rows: [] };
    return { rowCount: result.rowCount, rows: [...result.rows] };
  });

  return {
    asApiItem: vi.fn((data, requestId) => ({ data, ...(requestId ? { requestId } : {}) })),
    asApiList: vi.fn((data, pagination, requestId) => ({
      data,
      pagination,
      ...(requestId ? { requestId } : {}),
    })),
    createApiError: vi.fn((status, code, message, requestId, details) =>
      createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
    ),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'req-workspace', traceId: 'trace-workspace' })),
    isUuid: vi.fn(() => true),
    jsonResponse: vi.fn(createJsonResponse),
    logger: {
      error: vi.fn(),
    },
    readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
    readPathSegment: vi.fn(() => groupRow.id),
    requireRoles: vi.fn(() => null),
    resolveActorInfo: vi.fn(async () => ({ actor })),
    withInstanceScopedDb: vi.fn(async (_instanceId, work) => work({ query })),
    ...overrides,
  } satisfies GroupReadHandlerDeps;
};

describe('createGroupReadHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tenant groups with access check, pagination and canonical projection', async () => {
    const deps = createDeps([{ rowCount: 2, rows: [groupRow, { ...groupRow, id: 'group-2', display_name: 'Editors' }] }], {
      readPage: vi.fn(() => ({ page: 1, pageSize: 1 })),
    });
    const handlers = createGroupReadHandlers(deps);

    const response = await handlers.listGroupsInternal(new Request('http://localhost/api/v1/iam/inst-g/groups'), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: groupRow.id,
          groupKey: 'admins',
          displayName: 'Admins',
          memberCount: 2,
          roleCount: 1,
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 2 },
      requestId: 'req-groups',
    });
    expect(deps.requireRoles).toHaveBeenCalledWith(ctx, expect.any(Set), 'req-workspace');
    expect(deps.withInstanceScopedDb).toHaveBeenCalledWith('inst-g', expect.any(Function));
  });

  it('returns role guard errors before touching the database', async () => {
    const forbidden = new Response('Forbidden', { status: 403 });
    const deps = createDeps([], {
      requireRoles: vi.fn(() => forbidden),
    });
    const handlers = createGroupReadHandlers(deps);

    const response = await handlers.listGroupsInternal(new Request('http://localhost/api/v1/iam/inst-g/groups'), ctx);

    expect(response.status).toBe(403);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid group ids', async () => {
    const deps = createDeps([], {
      isUuid: vi.fn(() => false),
      readPathSegment: vi.fn(() => 'not-a-uuid'),
    });
    const handlers = createGroupReadHandlers(deps);

    const response = await handlers.getGroupInternal(
      new Request('http://localhost/api/v1/iam/inst-g/groups/not-a-uuid'),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns 404 when the group detail is missing', async () => {
    const deps = createDeps([{ rowCount: 0, rows: [] }]);
    const handlers = createGroupReadHandlers(deps);

    const response = await handlers.getGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupRow.id}`),
      ctx
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', message: 'Gruppe nicht gefunden' },
    });
  });

  it('returns group detail with assigned roles and memberships', async () => {
    const deps = createDeps([
      { rowCount: 1, rows: [groupRow] },
      { rowCount: 1, rows: [{ role_id: 'role-1' }] },
      {
        rowCount: 1,
        rows: [
          {
            instance_id: 'inst-g',
            account_id: 'account-1',
            group_id: groupRow.id,
            keycloak_subject: 'kc-user-1',
            display_name: 'Test User',
            valid_from: null,
            valid_until: null,
            assigned_at: '2026-01-03T00:00:00Z',
            assigned_by: 'account-admin',
          },
        ],
      },
    ]);
    const handlers = createGroupReadHandlers(deps);

    const response = await handlers.getGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupRow.id}`),
      ctx
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: groupRow.id,
        assignedRoleIds: ['role-1'],
        memberships: [
          {
            accountId: 'account-1',
            keycloakSubject: 'kc-user-1',
            displayName: 'Test User',
            assignedByAccountId: 'account-admin',
          },
        ],
      },
      requestId: 'req-groups',
    });
  });

  it('logs and maps database failures to 503', async () => {
    const deps = createDeps([], {
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('database down');
      }),
    });
    const handlers = createGroupReadHandlers(deps);

    const response = await handlers.listGroupsInternal(new Request('http://localhost/api/v1/iam/inst-g/groups'), ctx);

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Group list query failed',
      expect.objectContaining({
        operation: 'group_list',
        workspace_id: 'inst-g',
        error: 'database down',
      })
    );
  });
});
