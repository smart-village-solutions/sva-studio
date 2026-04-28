import { describe, expect, it, vi } from 'vitest';

import { createRoleMutationPersistence, type MutableRole } from './role-mutation-persistence.js';
import type { QueryClient } from './query-client.js';

const actor = {
  instanceId: 'tenant-a',
  actorAccountId: 'actor-account',
  requestId: 'request-1',
  traceId: 'trace-1',
};

const roleId = '00000000-0000-4000-8000-000000000001';

const mutableRole: MutableRole = {
  id: roleId,
  role_key: 'editor',
  role_name: 'editor',
  display_name: 'Editor',
  external_role_name: 'Editor',
  description: 'Can edit',
  is_system_role: false,
  managed_by: 'studio',
  role_level: 20,
  sync_state: 'synced',
  last_synced_at: '2026-01-01T00:00:00.000Z',
  last_error_code: null,
};

const roleListRow = {
  ...mutableRole,
  member_count: 3,
  permission_rows: [{ id: 'permission-1', permission_key: 'content.updatePayload', description: 'Update content' }],
};

const createClient = (queuedRows: readonly (readonly Record<string, unknown>[])[] = []) => {
  const queue = [...queuedRows];
  const queries: { text: string; values: readonly unknown[] }[] = [];
  const client: QueryClient = {
    async query<Row = unknown>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as Row[],
      };
    },
  };

  return { client, queries };
};

const createDeps = (client: QueryClient) => ({
  createApiError: vi.fn((status: number, code: 'conflict' | 'not_found', message: string, requestId?: string) =>
    Response.json({ error: { code, message }, requestId }, { status })
  ),
  emitActivityLog: vi.fn(async () => undefined),
  emitRoleAuditEvent: vi.fn(async () => undefined),
  notifyPermissionInvalidation: vi.fn(async () => undefined),
  setRoleSyncState: vi.fn(async () => undefined),
  withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (queryClient: QueryClient) => Promise<unknown>) =>
    work(client)
  ),
});

describe('role mutation persistence', () => {
  it('persists created roles with permissions, audit events and invalidation', async () => {
    const { client, queries } = createClient([[{ id: roleId }], [], [roleListRow]]);
    const deps = createDeps(client);

    await expect(
      createRoleMutationPersistence(deps).persistCreatedRole({
        actor,
        roleKey: 'editor',
        displayName: 'Editor',
        externalRoleName: 'Editor',
        description: 'Can edit',
        roleLevel: 20,
        permissionIds: ['permission-1'],
      })
    ).resolves.toMatchObject({
      id: roleId,
      roleKey: 'editor',
      permissions: [{ id: 'permission-1', permissionKey: 'content.updatePayload' }],
    });

    expect(queries[0]?.text).toContain('INSERT INTO iam.roles');
    expect(queries[1]?.text).toContain('INSERT INTO iam.role_permissions');
    expect(deps.emitRoleAuditEvent).toHaveBeenCalledTimes(2);
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ eventType: 'role.created', payload: expect.objectContaining({ role_key: 'editor' }) })
    );
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ trigger: 'role_created' })
    );
  });

  it('resolves mutable role conflicts as API responses', async () => {
    const notFound = createDeps(createClient([[]]).client);
    await expect(
      createRoleMutationPersistence(notFound).resolveMutableRole(actor, roleId)
    ).resolves.toMatchObject({ status: 404 });

    const system = createDeps(createClient([[{ ...mutableRole, is_system_role: true }]]).client);
    await expect(
      createRoleMutationPersistence(system).resolveMutableRole(actor, roleId)
    ).resolves.toMatchObject({ status: 409 });

    const external = createDeps(createClient([[{ ...mutableRole, managed_by: 'external' }]]).client);
    await expect(
      createRoleMutationPersistence(external).resolveMutableRole(actor, roleId)
    ).resolves.toMatchObject({ status: 409 });

    const editable = createDeps(createClient([[mutableRole]]).client);
    await expect(createRoleMutationPersistence(editable).resolveMutableRole(actor, roleId)).resolves.toEqual(mutableRole);
  });

  it('marks role sync state and audit result', async () => {
    const { client } = createClient();
    const deps = createDeps(client);

    await createRoleMutationPersistence(deps).markRoleSyncState({
      actor,
      roleId,
      operation: 'retry',
      result: 'failure',
      roleKey: 'editor',
      externalRoleName: 'Editor',
      errorCode: 'IDP_UNAVAILABLE',
      syncState: 'failed',
    });

    expect(deps.setRoleSyncState).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ syncState: 'failed', errorCode: 'IDP_UNAVAILABLE' })
    );
    expect(deps.emitRoleAuditEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ eventType: 'role.sync_failed', operation: 'retry', result: 'failure' })
    );
  });

  it('persists updated roles and replaces permissions when provided', async () => {
    const { client, queries } = createClient([[], [], [], [roleListRow]]);
    const deps = createDeps(client);

    await expect(
      createRoleMutationPersistence(deps).persistUpdatedRole({
        actor,
        roleId,
        existing: mutableRole,
        displayName: 'Editor Updated',
        description: undefined,
        roleLevel: 25,
        externalRoleName: 'Editor',
        permissionIds: ['permission-1'],
        operation: 'update',
      })
    ).resolves.toMatchObject({ id: roleId, roleName: 'Editor' });

    expect(queries[0]?.text).toContain('UPDATE iam.roles');
    expect(queries[1]?.text).toContain('DELETE FROM iam.role_permissions');
    expect(queries[2]?.text).toContain('INSERT INTO iam.role_permissions');
    expect(queries[2]?.text).not.toContain('$1::uuid');
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ trigger: 'role_updated' })
    );
  });

  it('protects delete resolution and deletes editable roles', async () => {
    const dependency = createDeps(createClient([[mutableRole], [{ used: 2 }]]).client);
    await expect(
      createRoleMutationPersistence(dependency).resolveDeletableRole(actor, roleId)
    ).resolves.toMatchObject({ status: 409 });

    const { client, queries } = createClient([[mutableRole], [{ used: 0 }], [], []]);
    const deps = createDeps(client);
    await expect(createRoleMutationPersistence(deps).resolveDeletableRole(actor, roleId)).resolves.toEqual(mutableRole);

    await createRoleMutationPersistence(deps).deleteRoleFromDatabase({
      actor,
      roleId,
      roleKey: 'editor',
      externalRoleName: 'Editor',
    });

    expect(queries.at(-2)?.text).toContain('DELETE FROM iam.role_permissions');
    expect(queries.at(-1)?.text).toContain('DELETE FROM iam.roles');
    expect(deps.emitActivityLog).toHaveBeenCalledWith(client, expect.objectContaining({ eventType: 'role.deleted' }));
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ trigger: 'role_deleted' })
    );
  });

  it('marks delete sync failures without mutating role rows', async () => {
    const { client } = createClient();
    const deps = createDeps(client);

    await createRoleMutationPersistence(deps).markDeleteRoleSyncState({
      actor,
      roleId,
      roleKey: 'editor',
      externalRoleName: 'Editor',
      result: 'failure',
      eventType: 'role.sync_failed',
      errorCode: 'IDP_FORBIDDEN',
      syncState: 'failed',
    });

    expect(deps.setRoleSyncState).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ syncState: 'failed', errorCode: 'IDP_FORBIDDEN' })
    );
    expect(deps.emitRoleAuditEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ operation: 'delete', result: 'failure', errorCode: 'IDP_FORBIDDEN' })
    );
  });
});
