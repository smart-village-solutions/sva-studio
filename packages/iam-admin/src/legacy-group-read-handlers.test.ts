import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLegacyGroupReadHandlers, type LegacyGroupReadHandlerDeps } from './legacy-group-read-handlers.js';

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
  requestId: 'req-legacy-groups',
};

const groupRow = {
  id: groupId,
  group_key: 'admins',
  display_name: 'Admins',
  description: null,
  group_type: 'role_bundle' as const,
  is_active: true,
  member_count: 1,
  role_rows: [{ role_id: 'role-1', role_key: 'editor', role_name: 'Editor' }],
};

const createJsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type QueryResult = {
  readonly rowCount: number;
  readonly rows: readonly unknown[];
};

const createDeps = (
  queryResults: QueryResult[] = [{ rowCount: 1, rows: [groupRow] }],
  overrides: Partial<LegacyGroupReadHandlerDeps> = {}
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
    consumeRateLimit: vi.fn(() => null),
    createApiError: vi.fn((status, code, message, requestId, details) =>
      createJsonResponse(status, { error: { code, message, ...(details ? { details } : {}) }, requestId })
    ),
    ensureFeature: vi.fn(() => null),
    getFeatureFlags: vi.fn(() => ({})),
    getWorkspaceContext: vi.fn(() => ({ requestId: 'req-workspace' })),
    isUuid: vi.fn(() => true),
    jsonResponse: vi.fn(createJsonResponse),
    logger: {
      error: vi.fn(),
    },
    readPathSegment: vi.fn(() => groupId),
    requireRoles: vi.fn(() => null),
    resolveActorInfo: vi.fn(async () => ({ actor })),
    withInstanceScopedDb: vi.fn(async (_instanceId, work) => work({ query })),
    ...overrides,
  } satisfies LegacyGroupReadHandlerDeps;
};

describe('createLegacyGroupReadHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists legacy IAM groups with feature, role and rate-limit checks', async () => {
    const deps = createDeps([{ rowCount: 1, rows: [groupRow] }]);
    const handlers = createLegacyGroupReadHandlers(deps);

    const response = await handlers.listGroupsInternal(new Request('http://localhost/api/v1/iam/groups'), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: groupId,
          groupKey: 'admins',
          roles: [{ roleId: 'role-1', roleKey: 'editor', roleName: 'Editor' }],
        },
      ],
      pagination: { page: 1, pageSize: 1, total: 1 },
      requestId: 'req-legacy-groups',
    });
    expect(deps.ensureFeature).toHaveBeenCalledWith({}, 'iam_admin', 'req-workspace');
    expect(deps.consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-g', actorKeycloakSubject: 'kc-admin-1', scope: 'read' })
    );
  });

  it('returns legacy group details with member rows', async () => {
    const deps = createDeps([
      {
        rowCount: 1,
        rows: [
          {
            ...groupRow,
            member_rows: [
              {
                account_id: 'account-1',
                group_id: groupId,
                group_key: 'admins',
                display_name: 'Admins',
                group_type: 'role_bundle',
                origin: 'manual',
                valid_from: null,
                valid_to: null,
              },
            ],
          },
        ],
      },
    ]);
    const handlers = createLegacyGroupReadHandlers(deps);

    const response = await handlers.getGroupInternal(new Request(`http://localhost/api/v1/iam/groups/${groupId}`), ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: groupId,
        members: [{ accountId: 'account-1', origin: 'manual' }],
      },
    });
  });

  it('returns 404 when a legacy group is missing', async () => {
    const deps = createDeps([{ rowCount: 0, rows: [] }]);
    const handlers = createLegacyGroupReadHandlers(deps);

    const response = await handlers.getGroupInternal(new Request(`http://localhost/api/v1/iam/groups/${groupId}`), ctx);

    expect(response.status).toBe(404);
  });

  it('logs structured diagnostics when loading a legacy group detail fails', async () => {
    const deps = createDeps([], {
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('relation "iam.groups" does not exist');
      }),
    });
    const handlers = createLegacyGroupReadHandlers(deps);

    const response = await handlers.getGroupInternal(new Request(`http://localhost/api/v1/iam/groups/${groupId}`), ctx);

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Legacy group detail query failed',
      expect.objectContaining({
        operation: 'legacy_group_detail',
        workspace_id: 'inst-g',
        group_id: groupId,
        request_id: 'req-legacy-groups',
        error: 'relation "iam.groups" does not exist',
      })
    );
  });

  it('returns early when the feature gate rejects the request', async () => {
    const gateResponse = new Response('disabled', { status: 403 });
    const deps = createDeps([], {
      ensureFeature: vi.fn(() => gateResponse),
    });
    const handlers = createLegacyGroupReadHandlers(deps);

    const response = await handlers.listGroupsInternal(new Request('http://localhost/api/v1/iam/groups'), ctx);

    expect(response.status).toBe(403);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });
});
