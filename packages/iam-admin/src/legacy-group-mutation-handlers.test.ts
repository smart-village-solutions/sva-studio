import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLegacyGroupMutationHandlers,
  type LegacyGroupMutationHandlerDeps,
} from './legacy-group-mutation-handlers.js';

const state = {
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-legacy-groups',
      traceId: 'trace-legacy-groups',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  reserve: { status: 'reserved' as const } as
    | { status: 'reserved' }
    | { status: 'replay'; responseStatus: number; responseBody: unknown }
    | { status: 'conflict'; message: string },
  parseResult: {
    ok: true as const,
    data: { groupKey: 'admins', displayName: 'Admins', roleIds: ['role-1'] },
    rawBody: '{}',
  } as { ok: true; data: Record<string, unknown>; rawBody: string } | { ok: false },
  rolesValid: true,
  createInsertId: '11111111-1111-1111-8111-111111111111',
  updateFound: true,
  deleteFound: true,
  loadGroup: {
    id: '11111111-1111-1111-8111-111111111111',
    group_key: 'admins',
    display_name: 'Admins',
    description: null,
    group_type: 'role_bundle',
    is_active: true,
    member_count: 0,
    role_rows: [],
    member_rows: [],
  } as Record<string, unknown> | undefined,
};

const completeIdempotency = vi.fn();
const emitActivityLog = vi.fn();
const notifyPermissionInvalidation = vi.fn();
const metricAdd = vi.fn();

const json = async (response: Response) => response.json() as Promise<Record<string, unknown>>;

const buildDeps = (): LegacyGroupMutationHandlerDeps => ({
  asApiItem: (data, requestId) => ({ data, ...(requestId ? { requestId } : {}) }),
  completeIdempotency,
  consumeRateLimit: vi.fn(() => null),
  createApiError: (status, code, message, requestId) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  emitActivityLog,
  ensureFeature: vi.fn(() => null),
  getFeatureFlags: vi.fn(() => ({})),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-legacy-groups' })),
  iamUserOperationsCounter: { add: metricAdd },
  isUuid: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  jsonResponse: (status, payload) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }),
  logger: { error: vi.fn() },
  notifyPermissionInvalidation,
  parseRequestBody: vi.fn(async () => state.parseResult as never),
  readPathSegment: vi.fn(
    (request: Request, index: number) =>
      new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
  ),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-group-1' })),
  requireRoles: vi.fn(() => null),
  reserveIdempotency: vi.fn(async () => state.reserve),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  resolveRolesByIds: vi.fn(async (_client, input) =>
    state.rolesValid ? input.roleIds.map((roleId) => ({ id: roleId })) : []
  ),
  toPayloadHash: vi.fn(() => 'hash-group-1'),
  validateCsrf: vi.fn(() => null),
  withInstanceScopedDb: vi.fn(async (_instanceId, work) => {
    const client = {
      query: vi.fn(async (text: string) => {
        if (text.includes('INSERT INTO iam.groups')) {
          return { rowCount: state.createInsertId ? 1 : 0, rows: state.createInsertId ? [{ id: state.createInsertId }] : [] };
        }
        if (text.includes('SET is_active = false')) {
          return {
            rowCount: state.deleteFound ? 1 : 0,
            rows: state.deleteFound ? [{ id: '11111111-1111-1111-8111-111111111111' }] : [],
          };
        }
        if (text.includes('UPDATE iam.groups') && text.includes('RETURNING id')) {
          return {
            rowCount: state.updateFound ? 1 : 0,
            rows: state.updateFound ? [{ id: '11111111-1111-1111-8111-111111111111' }] : [],
          };
        }
        if (text.includes('WHERE g.instance_id = $1') && text.includes('LIMIT 1')) {
          return { rowCount: state.loadGroup ? 1 : 0, rows: state.loadGroup ? [state.loadGroup] : [] };
        }
        return { rowCount: 0, rows: [] };
      }),
    };
    return work(client);
  }),
});

const ctx = {
  sessionId: 'session-1',
  user: {
    id: 'kc-1',
    roles: ['system_admin'],
  },
};

describe('legacy group mutation handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-legacy-groups',
        traceId: 'trace-legacy-groups',
      },
    };
    state.reserve = { status: 'reserved' };
    state.parseResult = {
      ok: true,
      data: { groupKey: 'admins', displayName: 'Admins', roleIds: ['role-1'] },
      rawBody: '{}',
    };
    state.rolesValid = true;
    state.createInsertId = '11111111-1111-1111-8111-111111111111';
    state.updateFound = true;
    state.deleteFound = true;
    state.loadGroup = {
      id: '11111111-1111-1111-8111-111111111111',
      group_key: 'admins',
      display_name: 'Admins',
      description: null,
      group_type: 'role_bundle',
      is_active: true,
      member_count: 0,
      role_rows: [],
      member_rows: [],
    };
  });

  it('creates legacy groups with idempotency and permission invalidation', async () => {
    const handlers = createLegacyGroupMutationHandlers(buildDeps());

    const response = await handlers.createGroupInternal(
      new Request('http://localhost/api/v1/iam/groups', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(201);
    await expect(json(response)).resolves.toMatchObject({
      data: { id: '11111111-1111-1111-8111-111111111111', groupKey: 'admins' },
      requestId: 'req-legacy-groups',
    });
    expect(emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'group.created',
        accountId: 'account-1',
      })
    );
    expect(notifyPermissionInvalidation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trigger: 'group_created' })
    );
    expect(completeIdempotency).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED', responseStatus: 201 }));
  });

  it('persists failed idempotency when create references unknown roles', async () => {
    state.rolesValid = false;
    const handlers = createLegacyGroupMutationHandlers(buildDeps());

    const response = await handlers.createGroupInternal(
      new Request('http://localhost/api/v1/iam/groups', { method: 'POST' }),
      ctx
    );

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toMatchObject({ error: { code: 'invalid_request' } });
    expect(completeIdempotency).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED', responseStatus: 400 }));
  });

  it('updates legacy groups and reloads the canonical group projection', async () => {
    state.parseResult = {
      ok: true,
      data: { displayName: 'Neue Admins', roleIds: ['role-1'], isActive: true },
      rawBody: '{}',
    };
    const handlers = createLegacyGroupMutationHandlers(buildDeps());

    const response = await handlers.updateGroupInternal(
      new Request('http://localhost/api/v1/iam/groups/11111111-1111-1111-8111-111111111111', { method: 'PATCH' }),
      ctx
    );

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toMatchObject({ data: { groupKey: 'admins' } });
    expect(notifyPermissionInvalidation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trigger: 'group_updated' })
    );
  });

  it('rejects invalid group ids before update touches the database', async () => {
    const deps = buildDeps();
    const handlers = createLegacyGroupMutationHandlers(deps);

    const response = await handlers.updateGroupInternal(
      new Request('http://localhost/api/v1/iam/groups/not-a-uuid', { method: 'PATCH' }),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns not_found when deleting an unknown legacy group', async () => {
    state.deleteFound = false;
    const handlers = createLegacyGroupMutationHandlers(buildDeps());

    const response = await handlers.deleteGroupInternal(
      new Request('http://localhost/api/v1/iam/groups/11111111-1111-1111-8111-111111111111', { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(404);
    await expect(json(response)).resolves.toMatchObject({ error: { code: 'not_found' } });
  });
});
