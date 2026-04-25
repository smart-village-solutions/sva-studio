import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actorResolution: {
    actor: {
      instanceId: 'de-musterhausen',
      actorAccountId: 'account-1',
      requestId: 'req-groups',
      traceId: 'trace-groups',
    },
  } as
    | { actor: { instanceId: string; actorAccountId?: string; requestId?: string; traceId?: string } }
    | { error: Response },
  reserve: { status: 'reserved' as 'reserved' | 'replay' | 'conflict' } as
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
    groupKey: 'admins',
    displayName: 'Admins',
    groupType: 'role_bundle',
    isActive: true,
    memberCount: 0,
    roles: [],
    members: [],
  } as Record<string, unknown> | undefined,
  completeIdempotency: vi.fn(),
  emitActivityLog: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-groups' }),
}));

vi.mock('../shared/db-helpers.js', () => ({
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: (data: unknown, requestId?: string) => ({ data, ...(requestId ? { requestId } : {}) }),
  asApiList: (data: unknown, pagination: unknown, requestId?: string) => ({ data, pagination, ...(requestId ? { requestId } : {}) }),
  createApiError: (
    status: number,
    code: string,
    message: string,
    requestId?: string
  ) =>
    new Response(JSON.stringify({ error: { code, message }, ...(requestId ? { requestId } : {}) }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  parseRequestBody: vi.fn(async () => state.parseResult),
  readPathSegment: vi.fn(
    (request: Request, index: number) =>
      new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0)[index]
  ),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-group-1' })),
  toPayloadHash: vi.fn(() => 'hash-group-1'),
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('./feature-flags.js', () => ({
  getFeatureFlags: vi.fn(() => ({})),
  ensureFeature: vi.fn(() => null),
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: vi.fn(() => null),
}));

vi.mock('./schemas.js', () => ({
  createGroupSchema: {},
  updateGroupSchema: {},
}));

vi.mock('./shared.js', () => ({
  completeIdempotency: state.completeIdempotency,
  emitActivityLog: state.emitActivityLog,
  iamUserOperationsCounter: { add: vi.fn() },
  logger: { error: vi.fn() },
  notifyPermissionInvalidation: vi.fn(),
  requireRoles: vi.fn(() => null),
  reserveIdempotency: vi.fn(async () => state.reserve),
  resolveActorInfo: vi.fn(async () => state.actorResolution),
  resolveRolesByIds: vi.fn(async (_client: unknown, input: { roleIds: readonly string[] }) =>
    state.rolesValid
      ? input.roleIds.map((roleId) => ({ id: roleId, role_key: roleId, role_name: roleId }))
      : []
  ),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, fn: (client: unknown) => Promise<unknown>) => {
    const client = {
      query: vi.fn(async (text: string) => {
        if (text.includes('INSERT INTO iam.groups')) {
          return { rows: state.createInsertId ? [{ id: state.createInsertId }] : [] };
        }
        if (text.includes('SET is_active = false')) {
          return { rows: state.deleteFound ? [{ id: '11111111-1111-1111-8111-111111111111' }] : [] };
        }
        if (text.includes('UPDATE iam.groups') && text.includes('RETURNING id')) {
          return { rows: state.updateFound ? [{ id: '11111111-1111-1111-8111-111111111111' }] : [] };
        }
        if (text.includes('WHERE g.instance_id = $1') && text.includes('LIMIT 1')) {
          return { rows: state.loadGroup ? [state.loadGroup] : [] };
        }
        return { rows: [] };
      }),
    };
    return fn(client);
  }),
}));

import { createGroupInternal, deleteGroupInternal, updateGroupInternal } from './groups-handlers';

const ctx = {
  user: {
    id: 'kc-1',
    roles: ['system_admin'],
  },
} as never;

describe('iam-account-management/groups-handlers internals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actorResolution = {
      actor: {
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-groups',
        traceId: 'trace-groups',
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
      groupKey: 'admins',
      displayName: 'Admins',
      groupType: 'role_bundle',
      isActive: true,
      memberCount: 0,
      roles: [],
      members: [],
    };
  });

  it('writes group activity logs without account-only subject ids', async () => {
    const response = await createGroupInternal(new Request('http://localhost/api/v1/iam/groups', { method: 'POST' }), ctx);

    expect(response.status).toBe(201);
    expect(state.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'group.created',
        accountId: 'account-1',
        payload: expect.objectContaining({
          groupId: '11111111-1111-1111-8111-111111111111',
          groupKey: 'admins',
        }),
      })
    );
    expect(state.emitActivityLog).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subjectId: '11111111-1111-1111-8111-111111111111',
      })
    );
  });

  it('returns replay and conflict responses for idempotent group creation', async () => {
    state.reserve = {
      status: 'replay',
      responseStatus: 202,
      responseBody: { data: { id: 'group-1' } },
    };

    const replay = await createGroupInternal(new Request('http://localhost/api/v1/iam/groups', { method: 'POST' }), ctx);
    expect(replay.status).toBe(202);

    state.reserve = { status: 'conflict', message: 'payload mismatch' };
    const conflict = await createGroupInternal(new Request('http://localhost/api/v1/iam/groups', { method: 'POST' }), ctx);
    expect(conflict.status).toBe(409);
  });

  it('fails group creation with invalid role references and persists the failed idempotency result', async () => {
    state.rolesValid = false;

    const response = await createGroupInternal(new Request('http://localhost/api/v1/iam/groups', { method: 'POST' }), ctx);

    expect(response.status).toBe(400);
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/iam/groups',
        status: 'FAILED',
        responseStatus: 400,
      })
    );
  });

  it('rejects invalid group ids and invalid role updates', async () => {
    const invalidId = await updateGroupInternal(
      new Request('http://localhost/api/v1/iam/groups/not-a-uuid', { method: 'PATCH' }),
      ctx
    );
    expect(invalidId.status).toBe(400);

    state.rolesValid = false;
    state.parseResult = {
      ok: true,
      data: { roleIds: ['role-1', 'role-2'] },
      rawBody: '{}',
    };
    const invalidRoles = await updateGroupInternal(
      new Request('http://localhost/api/v1/iam/groups/11111111-1111-1111-8111-111111111111', { method: 'PATCH' }),
      ctx
    );
    expect(invalidRoles.status).toBe(400);
  });

  it('returns not_found when deleting an unknown group', async () => {
    state.deleteFound = false;

    const response = await deleteGroupInternal(
      new Request('http://localhost/api/v1/iam/groups/11111111-1111-1111-8111-111111111111', { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'not_found',
        message: 'Gruppe nicht gefunden.',
      },
      requestId: 'req-groups',
    });
  });
});
