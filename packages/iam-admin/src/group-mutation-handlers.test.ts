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

  it('returns invalid_request for malformed group ids on update', async () => {
    const deps = createDeps([], {
      readPathSegment: vi.fn(() => 'not-a-uuid'),
      isUuid: vi.fn(() => false),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.updateGroupInternal(
      new Request('http://localhost/api/v1/iam/inst-g/groups/not-a-uuid', { method: 'PATCH', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', message: 'Ungültige Gruppen-ID' },
    });
  });

  it('returns not found when the target group does not exist during update', async () => {
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({
        ok: true as const,
        data: { displayName: 'Renamed' },
      })),
      withInstanceScopedDb: vi.fn(async (_instanceId, work) =>
        work({
          query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
        } as never)
      ),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.updateGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}`, { method: 'PATCH', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', message: 'Gruppe nicht gefunden' },
    });
  });

  it('updates groups, logs the mutation and returns the canonical id', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [{ id: groupId }] }));
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({
        ok: true as const,
        data: { displayName: 'Renamed', description: null, isActive: false },
      })),
      withInstanceScopedDb: vi.fn(async (_instanceId, work) => work({ query } as never)),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.updateGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}`, { method: 'PATCH', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE iam.groups SET'),
      ['inst-g', groupId, 'Renamed', null, false]
    );
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'iam_group_updated',
        payload: { group_id: groupId, changes: { displayName: 'Renamed', description: null, isActive: false } },
      })
    );
    expect(deps.logger.info).toHaveBeenCalledWith(
      'Group updated',
      expect.objectContaining({ operation: 'group_update', workspace_id: 'inst-g', group_id: groupId })
    );
  });

  it('logs and maps update database failures', async () => {
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({
        ok: true as const,
        data: { displayName: 'Renamed' },
      })),
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('update failed');
      }),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.updateGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}`, { method: 'PATCH', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Group update failed',
      expect.objectContaining({
        operation: 'group_update',
        workspace_id: 'inst-g',
        group_id: groupId,
        error: 'update failed',
      })
    );
  });

  it('returns invalid_request for malformed update payloads', async () => {
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({ ok: false as const })),
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

  it('returns not found when deleting an unknown group', async () => {
    const deps = createDeps([
      { rowCount: 0, rows: [] },
      { rowCount: 0, rows: [] },
    ]);
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.deleteGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}`, { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(404);
    expect(deps.publishGroupEvent).not.toHaveBeenCalled();
  });

  it('logs and maps delete database failures', async () => {
    const deps = createDeps([], {
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('delete failed');
      }),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.deleteGroupInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}`, { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Group deletion failed',
      expect.objectContaining({
        operation: 'group_delete',
        workspace_id: 'inst-g',
        group_id: groupId,
        error: 'delete failed',
      })
    );
  });

  it('assigns roles to groups and publishes permission change events', async () => {
    const deps = createDeps();
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.assignGroupRoleInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/roles`, { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.publishGroupEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'RolePermissionChanged',
        instanceId: 'inst-g',
        roleId: groupId,
      })
    );
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'iam_group_role_assigned',
        payload: { group_id: groupId, role_id: groupId },
      })
    );
  });

  it('rejects malformed role ids before removing group roles', async () => {
    const deps = createDeps([], {
      readPathSegment: vi.fn((_request, index) => (index === 6 ? 'not-a-role-id' : groupId)),
      isUuid: vi.fn((value: string) => value !== 'not-a-role-id'),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.removeGroupRoleInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/roles/not-a-role-id`, { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('returns invalid_request for malformed group role payloads', async () => {
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({ ok: false as const })),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.assignGroupRoleInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/roles`, { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('logs and maps group role assignment failures', async () => {
    const deps = createDeps([], {
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('role assign failed');
      }),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.assignGroupRoleInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/roles`, { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Group role assignment failed',
      expect.objectContaining({
        operation: 'group_role_assign',
        workspace_id: 'inst-g',
        group_id: groupId,
        error: 'role assign failed',
      })
    );
  });

  it('removes group roles and emits the removal event', async () => {
    const deps = createDeps();
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.removeGroupRoleInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/roles/${groupId}`, { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.publishGroupEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'RolePermissionChanged',
        instanceId: 'inst-g',
        roleId: groupId,
      })
    );
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'iam_group_role_removed',
        payload: { group_id: groupId, role_id: groupId },
      })
    );
  });

  it('logs and maps group role removal failures', async () => {
    const deps = createDeps([], {
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('role removal failed');
      }),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.removeGroupRoleInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/roles/${groupId}`, { method: 'DELETE' }),
      ctx
    );

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Group role removal failed',
      expect.objectContaining({
        operation: 'group_role_remove',
        workspace_id: 'inst-g',
        group_id: groupId,
        error: 'role removal failed',
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

  it('assigns group memberships and publishes member added events', async () => {
    const deps = createDeps([{ rowCount: 1, rows: [{ id: 'account-1' }] }]);
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.assignGroupMembershipInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/members`, { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.publishGroupEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'GroupMembershipChanged',
        groupId,
        accountId: 'account-1',
        keycloakSubject: 'kc-user-1',
        changeType: 'added',
      })
    );
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'iam_group_member_added',
        payload: { group_id: groupId, account_id: 'account-1' },
      })
    );
  });

  it('logs and maps unexpected membership assignment failures', async () => {
    const deps = createDeps([], {
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('membership write failed');
      }),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.assignGroupMembershipInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/members`, { method: 'POST', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Group membership assignment failed',
      expect.objectContaining({
        operation: 'group_membership_add',
        workspace_id: 'inst-g',
        group_id: groupId,
        error: 'membership write failed',
      })
    );
  });

  it('removes memberships and still succeeds when the membership account no longer resolves', async () => {
    const deps = createDeps([{ rowCount: 0, rows: [] }], {
      parseRequestBody: vi.fn(async () => ({
        ok: true as const,
        data: { keycloakSubject: 'missing-user' },
      })),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.removeGroupMembershipInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/members`, { method: 'DELETE', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.publishGroupEvent).not.toHaveBeenCalled();
    expect(deps.emitActivityLog).not.toHaveBeenCalled();
  });

  it('removes memberships and publishes the removed event when the account resolves', async () => {
    const deps = createDeps([{ rowCount: 1, rows: [{ id: 'account-1' }] }], {
      parseRequestBody: vi.fn(async () => ({
        ok: true as const,
        data: { keycloakSubject: 'kc-user-1' },
      })),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.removeGroupMembershipInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/members`, { method: 'DELETE', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(200);
    expect(deps.publishGroupEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'GroupMembershipChanged',
        groupId,
        accountId: 'account-1',
        keycloakSubject: 'kc-user-1',
        changeType: 'removed',
      })
    );
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'iam_group_member_removed',
        payload: { group_id: groupId, account_id: 'account-1' },
      })
    );
  });

  it('returns invalid_request for malformed membership removal payloads', async () => {
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({ ok: false as const })),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.removeGroupMembershipInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/members`, { method: 'DELETE', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(400);
    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('logs and maps membership removal failures', async () => {
    const deps = createDeps([], {
      parseRequestBody: vi.fn(async () => ({
        ok: true as const,
        data: { keycloakSubject: 'kc-user-1' },
      })),
      withInstanceScopedDb: vi.fn(async () => {
        throw new Error('membership removal failed');
      }),
    });
    const handlers = createGroupMutationHandlers(deps);

    const response = await handlers.removeGroupMembershipInternal(
      new Request(`http://localhost/api/v1/iam/inst-g/groups/${groupId}/members`, { method: 'DELETE', body: '{}' }),
      ctx
    );

    expect(response.status).toBe(503);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Group membership removal failed',
      expect.objectContaining({
        operation: 'group_membership_remove',
        workspace_id: 'inst-g',
        group_id: groupId,
        error: 'membership removal failed',
      })
    );
  });
});
