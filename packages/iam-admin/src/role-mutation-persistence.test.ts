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
  permission_rows: [
    { id: 'permission-1', permission_key: 'content.updatePayload', description: 'Update content' },
  ],
};

type QueuedQueryResult =
  | readonly Record<string, unknown>[]
  | { readonly rows: readonly Record<string, unknown>[]; readonly rowCount?: number };

const createClient = (queuedResults: readonly QueuedQueryResult[] = []) => {
  const queue = [...queuedResults];
  const queries: { text: string; values: readonly unknown[] }[] = [];
  const client: QueryClient = {
    async query<Row = unknown>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      const next = queue.shift() ?? [];
      const rows = Array.isArray(next) ? next : next.rows;
      const rowCount = Array.isArray(next) ? next.length : (next.rowCount ?? next.rows.length);
      return {
        rowCount,
        rows: rows as Row[],
      };
    },
  };

  return { client, queries };
};

const createDeps = (client: QueryClient) => ({
  createApiError: vi.fn(
    (
      status: number,
      code: 'conflict' | 'invalid_request' | 'not_found',
      message: string,
      requestId?: string
    ) => Response.json({ error: { code, message }, requestId }, { status })
  ),
  emitActivityLog: vi.fn(async () => undefined),
  emitRoleAuditEvent: vi.fn(async () => undefined),
  notifyPermissionInvalidation: vi.fn(async () => undefined),
  setRoleSyncState: vi.fn(async () => undefined),
  withInstanceScopedDb: vi.fn(
    async (_instanceId: string, work: (queryClient: QueryClient) => Promise<unknown>) =>
      work(client)
  ),
});

describe('role mutation persistence', () => {
  it('persists created roles with permissions, audit events and invalidation', async () => {
    const { client, queries } = createClient([
      [{ id: roleId }],
      [{ id: 'permission-1', permission_key: 'content.updatePayload' }],
      [],
      [roleListRow],
    ]);
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
    expect(queries[1]?.text).toContain('SELECT id::text AS id, permission_key');
    expect(queries[2]?.text).toContain('INSERT INTO iam.role_permissions');
    expect(deps.emitRoleAuditEvent).toHaveBeenCalledTimes(2);
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: 'role.created',
        payload: expect.objectContaining({ role_key: 'editor' }),
      })
    );
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ trigger: 'role_created' })
    );
  });

  it('serializes generated role keys and uses the smallest available suffix', async () => {
    const generatedRoleRow = {
      ...roleListRow,
      role_key: 'editor_3',
      role_name: 'editor_3',
      external_role_name: 'editor_3',
    };
    const { client, queries } = createClient([
      [],
      [{ role_key: 'editor' }, { role_key: 'editor_2' }],
      [{ id: roleId }],
      [generatedRoleRow],
    ]);
    const deps = createDeps(client);

    await expect(
      createRoleMutationPersistence(deps).persistCreatedRole({
        actor,
        roleKey: 'editor',
        generateUniqueRoleKey: true,
        displayName: 'Editor',
        externalRoleName: 'editor',
        roleLevel: 0,
        permissionIds: [],
      })
    ).resolves.toMatchObject({ roleKey: 'editor_3' });

    expect(queries[0]?.text).toContain('pg_advisory_xact_lock');
    expect(queries[1]?.text).toContain('FROM iam.roles');
    expect(queries[1]?.text).toContain('left(role_key, length($2) + 1)');
    expect(queries[1]?.text).not.toContain('LIKE');
    expect(queries[2]?.values.slice(1, 5)).toEqual(['editor_3', 'editor_3', 'Editor', 'editor_3']);
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ payload: expect.objectContaining({ role_key: 'editor_3' }) })
    );
  });

  it('allocates distinct generated keys for parallel role creates', async () => {
    const storedRoles = new Map<string, typeof roleListRow>();
    let nextRoleId = 1;
    let transactionQueue = Promise.resolve();
    const deps = createDeps(createClient().client);

    deps.withInstanceScopedDb = vi.fn(async (_instanceId, work) => {
      const previousTransaction = transactionQueue;
      let releaseTransaction = () => undefined;
      transactionQueue = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });
      await previousTransaction;

      const client: QueryClient = {
        async query<Row = unknown>(text: string, values: readonly unknown[] = []) {
          if (text.includes('pg_advisory_xact_lock')) {
            return { rowCount: 1, rows: [] as Row[] };
          }
          if (text.includes('SELECT role_key')) {
            return {
              rowCount: storedRoles.size,
              rows: [...storedRoles.values()].map(({ role_key }) => ({ role_key })) as Row[],
            };
          }
          if (text.includes('INSERT INTO iam.roles')) {
            const id = `00000000-0000-4000-8000-${String(nextRoleId).padStart(12, '0')}`;
            nextRoleId += 1;
            const roleKey = String(values[1]);
            storedRoles.set(id, {
              ...roleListRow,
              id,
              role_key: roleKey,
              role_name: roleKey,
              display_name: String(values[3]),
              external_role_name: roleKey,
              role_level: Number(values[6]),
              member_count: 0,
              permission_rows: [],
            });
            return { rowCount: 1, rows: [{ id }] as Row[] };
          }

          const storedRole = storedRoles.get(String(values[1]));
          return {
            rowCount: storedRole ? 1 : 0,
            rows: (storedRole ? [storedRole] : []) as Row[],
          };
        },
      };

      try {
        return await work(client);
      } finally {
        releaseTransaction();
      }
    });

    const persistence = createRoleMutationPersistence(deps);
    const createRole = () =>
      persistence.persistCreatedRole({
        actor,
        roleKey: 'redaktion',
        generateUniqueRoleKey: true,
        displayName: 'Redaktion',
        externalRoleName: 'redaktion',
        roleLevel: 0,
        permissionIds: [],
      });

    const createdRoles = await Promise.all([createRole(), createRole()]);

    expect(createdRoles.map((role) => role.roleKey)).toEqual(['redaktion', 'redaktion_2']);
  });

  it('resolves mutable role conflicts as API responses', async () => {
    const notFound = createDeps(createClient([[]]).client);
    await expect(
      createRoleMutationPersistence(notFound).resolveMutableRole(actor, roleId)
    ).resolves.toMatchObject({ status: 404 });

    const system = createDeps(
      createClient([
        [
          {
            ...mutableRole,
            role_key: 'system_admin',
            role_name: 'system_admin',
            external_role_name: 'system_admin',
            is_system_role: true,
          },
        ],
      ]).client
    );
    await expect(
      createRoleMutationPersistence(system).resolveMutableRole(actor, roleId)
    ).resolves.toMatchObject({ status: 409 });

    const external = createDeps(
      createClient([[{ ...mutableRole, managed_by: 'external' }]]).client
    );
    await expect(
      createRoleMutationPersistence(external).resolveMutableRole(actor, roleId)
    ).resolves.toMatchObject({ status: 409 });

    const editable = createDeps(createClient([[mutableRole]]).client);
    await expect(
      createRoleMutationPersistence(editable).resolveMutableRole(actor, roleId)
    ).resolves.toEqual(mutableRole);

    const editableLegacyBootstrapRole = {
      ...mutableRole,
      role_key: 'app_manager',
      role_name: 'app_manager',
      external_role_name: 'app_manager',
      is_system_role: true,
    };
    const legacyEditable = createDeps(createClient([[editableLegacyBootstrapRole]]).client);
    await expect(
      createRoleMutationPersistence(legacyEditable).resolveMutableRole(actor, roleId)
    ).resolves.toEqual(editableLegacyBootstrapRole);
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
      expect.objectContaining({
        eventType: 'role.sync_failed',
        operation: 'retry',
        result: 'failure',
      })
    );
  });

  it('persists updated roles and replaces permissions when provided', async () => {
    const { client, queries } = createClient([
      [],
      [{ id: 'permission-1', permission_key: 'content.updatePayload' }],
      [],
      [],
      [roleListRow],
    ]);
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
    expect(queries[1]?.text).toContain('SELECT id::text AS id, permission_key');
    expect(queries[2]?.text).toContain('DELETE FROM iam.role_permissions');
    expect(queries[3]?.text).toContain('INSERT INTO iam.role_permissions');
    expect(queries[3]?.text).not.toContain('$1::uuid');
    expect(deps.notifyPermissionInvalidation).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ trigger: 'role_updated' })
    );
  });

  it('normalizes non-scope permission assignments to accessScope all before persisting', async () => {
    const { client, queries } = createClient([
      [{ id: roleId }],
      [
        { id: 'permission-1', permission_key: 'content.updatePayload' },
        { id: 'permission-2', permission_key: 'iam.configure' },
      ],
      [],
      [roleListRow],
    ]);
    const deps = createDeps(client);

    await createRoleMutationPersistence(deps).persistCreatedRole({
      actor,
      roleKey: 'editor',
      displayName: 'Editor',
      externalRoleName: 'Editor',
      description: 'Can edit',
      roleLevel: 20,
      permissionIds: [],
      permissionAssignments: [
        { permissionId: 'permission-1', accessScope: 'organization' },
        { permissionId: 'permission-2', accessScope: 'own' },
      ],
    });

    expect(queries[2]?.text).toContain('INSERT INTO iam.role_permissions');
    expect(queries[2]?.values[3]).toEqual(['organization', 'all']);
  });

  it('rejects root-only and unknown tenant permission assignments before mutation work', async () => {
    const { client } = createClient([
      [{ id: 'permission-1', permission_key: 'instance.registry.manage' }],
      [],
    ]);
    const deps = createDeps(client);
    const persistence = createRoleMutationPersistence(deps);

    await expect(
      persistence.validateRequestedPermissions({
        actor,
        permissionIds: ['permission-1'],
      })
    ).resolves.toMatchObject({ status: 400 });

    await expect(
      persistence.validateRequestedPermissions({
        actor,
        permissionIds: ['missing-permission-id'],
      })
    ).resolves.toMatchObject({ status: 400 });
  });

  it('rejects duplicate permission ids with a dedicated invalid_request error', async () => {
    const { client } = createClient();
    const persistence = createRoleMutationPersistence(createDeps(client));

    const response = await persistence.validateRequestedPermissions({
      actor,
      permissionIds: ['permission-1', 'permission-1'],
    });

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'Berechtigungen dürfen im Payload nicht doppelt vorkommen.',
      },
      requestId: 'request-1',
    });
  });

  it('protects delete resolution and deletes editable roles', async () => {
    const deletableLegacyBootstrapRole = {
      ...mutableRole,
      role_key: 'editor',
      role_name: 'editor',
      external_role_name: 'editor',
      is_system_role: true,
    };
    const legacyDeletable = createDeps(createClient([[deletableLegacyBootstrapRole]]).client);
    await expect(
      createRoleMutationPersistence(legacyDeletable).resolveDeletableRole(actor, roleId)
    ).resolves.toEqual(deletableLegacyBootstrapRole);

    const { client, queries } = createClient([
      [mutableRole],
      { rows: [], rowCount: 2 },
      { rows: [], rowCount: 3 },
      [],
      [],
    ]);
    const deps = createDeps(client);
    await expect(
      createRoleMutationPersistence(deps).resolveDeletableRole(actor, roleId)
    ).resolves.toEqual(mutableRole);

    await createRoleMutationPersistence(deps).deleteRoleFromDatabase({
      actor,
      roleId,
      roleKey: 'editor',
      externalRoleName: 'Editor',
    });

    expect(queries.at(-4)?.text).toContain('DELETE FROM iam.account_roles');
    expect(queries.at(-3)?.text).toContain('DELETE FROM iam.group_roles');
    expect(queries.at(-2)?.text).toContain('DELETE FROM iam.role_permissions');
    expect(queries.at(-1)?.text).toContain('DELETE FROM iam.roles');
    expect(deps.emitActivityLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: 'role.deleted',
        payload: expect.objectContaining({
          removed_account_role_assignments: 2,
          removed_group_role_assignments: 3,
        }),
      })
    );
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
      expect.objectContaining({
        operation: 'delete',
        result: 'failure',
        errorCode: 'IDP_FORBIDDEN',
      })
    );
  });
});
