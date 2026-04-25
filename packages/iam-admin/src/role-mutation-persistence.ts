import type { ManagedRoleRow } from './types.js';

import { loadRoleById, loadRoleListItemById } from './role-query.js';
import type { QueryClient } from './query-client.js';

export type RoleMutationPersistenceActor = {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type MutableRole = ManagedRoleRow & {
  readonly is_system_role: boolean;
  readonly managed_by: string;
  readonly role_level: number;
  readonly role_key: string;
  readonly description: string | null;
};

type RoleAuditEventInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly roleId: string;
  readonly eventType: 'role.sync_started' | 'role.sync_failed' | 'role.sync_succeeded';
  readonly operation: 'create' | 'update' | 'retry' | 'delete';
  readonly result: 'success' | 'failure';
  readonly roleKey: string;
  readonly externalRoleName: string;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type RoleActivityLogInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly eventType: 'role.created' | 'role.updated' | 'role.deleted';
  readonly result: 'success';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type RoleMutationPersistenceDeps = {
  readonly createApiError: (
    status: number,
    code: 'conflict' | 'not_found',
    message: string,
    requestId?: string
  ) => Response;
  readonly emitActivityLog: (client: QueryClient, input: RoleActivityLogInput) => Promise<void>;
  readonly emitRoleAuditEvent: (client: QueryClient, input: RoleAuditEventInput) => Promise<void>;
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly trigger: 'role_created' | 'role_updated' | 'role_deleted';
    }
  ) => Promise<void>;
  readonly setRoleSyncState: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly roleId: string;
      readonly syncState: 'pending' | 'failed' | 'synced';
      readonly errorCode: string | null;
      readonly syncedAt?: boolean;
    }
  ) => Promise<void>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

export const createRoleMutationPersistence = (deps: RoleMutationPersistenceDeps) => {
  const persistCreatedRole = async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleKey: string;
    readonly displayName: string;
    readonly externalRoleName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly permissionIds: readonly string[];
  }) =>
    deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      const inserted = await client.query<{ readonly id: string }>(
        `
INSERT INTO iam.roles (
  instance_id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at,
  last_error_code
)
VALUES ($1, $2, $3, $4, $5, $6, false, $7, 'studio', 'synced', NOW(), NULL)
RETURNING id;
`,
        [
          input.actor.instanceId,
          input.roleKey,
          input.roleKey,
          input.displayName,
          input.externalRoleName,
          input.description ?? null,
          input.roleLevel,
        ]
      );
      const roleId = inserted.rows[0]?.id;
      if (!roleId) {
        throw new Error('conflict');
      }

      if (input.permissionIds.length > 0) {
        await client.query(
          `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
          [input.actor.instanceId, roleId, input.permissionIds]
        );
      }

      await deps.emitRoleAuditEvent(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_started',
        operation: 'create',
        result: 'success',
        roleKey: input.roleKey,
        externalRoleName: input.externalRoleName,
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });

      await deps.emitActivityLog(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        eventType: 'role.created',
        result: 'success',
        payload: {
          role_id: roleId,
          role_key: input.roleKey,
          display_name: input.displayName,
        },
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });

      await deps.emitRoleAuditEvent(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_succeeded',
        operation: 'create',
        result: 'success',
        roleKey: input.roleKey,
        externalRoleName: input.externalRoleName,
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });

      await deps.notifyPermissionInvalidation(client, {
        instanceId: input.actor.instanceId,
        trigger: 'role_created',
      });

      const roleItem = await loadRoleListItemById(client, {
        instanceId: input.actor.instanceId,
        roleId,
      });
      if (!roleItem) {
        throw new Error('role_load_failed');
      }

      return roleItem;
    });

  const resolveMutableRole = async (
    actor: RoleMutationPersistenceActor,
    roleId: string
  ): Promise<MutableRole | Response> => {
    const existing = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actor.instanceId, roleId })
    );

    if (!existing) {
      return deps.createApiError(404, 'not_found', 'Rolle nicht gefunden.', actor.requestId);
    }
    if (existing.is_system_role) {
      return deps.createApiError(409, 'conflict', 'System-Rollen können nicht geändert werden.', actor.requestId);
    }
    if (existing.managed_by !== 'studio') {
      return deps.createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht geändert werden.',
        actor.requestId
      );
    }

    return existing;
  };

  const markRoleSyncState = async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly operation: 'update' | 'retry';
    readonly result: 'success' | 'failure';
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly errorCode?: string;
    readonly syncState: 'pending' | 'failed' | 'synced';
    readonly syncedAt?: boolean;
  }) => {
    await deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      await deps.setRoleSyncState(client, {
        instanceId: input.actor.instanceId,
        roleId: input.roleId,
        syncState: input.syncState,
        errorCode: input.errorCode ?? null,
        ...(input.syncedAt ? { syncedAt: true } : {}),
      });
      await deps.emitRoleAuditEvent(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        roleId: input.roleId,
        eventType: input.result === 'failure' ? 'role.sync_failed' : 'role.sync_started',
        operation: input.operation,
        result: input.result,
        roleKey: input.roleKey,
        externalRoleName: input.externalRoleName,
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });
    });
  };

  const persistUpdatedRole = async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly existing: MutableRole;
    readonly displayName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly externalRoleName: string;
    readonly permissionIds?: readonly string[];
    readonly operation: 'update' | 'retry';
  }) =>
    deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      await client.query(
        `
UPDATE iam.roles
SET
  display_name = $3,
  description = $4,
  role_level = $5,
  sync_state = 'synced',
  last_synced_at = NOW(),
  last_error_code = NULL,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
        [input.actor.instanceId, input.roleId, input.displayName, input.description ?? null, input.roleLevel]
      );

      if (input.permissionIds) {
        await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;', [
          input.actor.instanceId,
          input.roleId,
        ]);
        if (input.permissionIds.length > 0) {
          await client.query(
            `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1::uuid, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
            [input.actor.instanceId, input.roleId, input.permissionIds]
          );
        }
      }

      await deps.emitActivityLog(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        eventType: 'role.updated',
        result: 'success',
        payload: {
          role_id: input.roleId,
          role_key: input.existing.role_key,
          display_name: input.displayName,
        },
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });
      await deps.emitRoleAuditEvent(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        roleId: input.roleId,
        eventType: 'role.sync_succeeded',
        operation: input.operation,
        result: 'success',
        roleKey: input.existing.role_key,
        externalRoleName: input.externalRoleName,
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });
      await deps.notifyPermissionInvalidation(client, {
        instanceId: input.actor.instanceId,
        trigger: 'role_updated',
      });

      const updatedRole = await loadRoleListItemById(client, {
        instanceId: input.actor.instanceId,
        roleId: input.roleId,
      });
      if (!updatedRole) {
        throw new Error('role_load_failed');
      }
      return updatedRole;
    });

  const resolveDeletableRole = async (
    actor: RoleMutationPersistenceActor,
    roleId: string
  ): Promise<MutableRole | Response> => {
    const existing = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actor.instanceId, roleId })
    );

    if (!existing) {
      return deps.createApiError(404, 'not_found', 'Rolle nicht gefunden.', actor.requestId);
    }
    if (existing.is_system_role) {
      return deps.createApiError(409, 'conflict', 'System-Rollen können nicht gelöscht werden.', actor.requestId);
    }
    if (existing.managed_by !== 'studio') {
      return deps.createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht gelöscht werden.',
        actor.requestId
      );
    }

    const dependency = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
      const result = await client.query<{ readonly used: number }>(
        `
SELECT COUNT(*)::int AS used
FROM iam.account_roles
WHERE instance_id = $1
  AND role_id = $2::uuid;
`,
        [actor.instanceId, roleId]
      );
      return result.rows[0]?.used ?? 0;
    });
    if (dependency > 0) {
      return deps.createApiError(409, 'conflict', 'Rolle wird noch von Nutzern verwendet.', actor.requestId);
    }

    return existing;
  };

  const markDeleteRoleSyncState = async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly result: 'success' | 'failure';
    readonly eventType: 'role.sync_started' | 'role.sync_failed' | 'role.sync_succeeded';
    readonly errorCode?: string;
    readonly syncState?: 'pending' | 'failed';
  }) => {
    await deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      if (input.syncState) {
        await deps.setRoleSyncState(client, {
          instanceId: input.actor.instanceId,
          roleId: input.roleId,
          syncState: input.syncState,
          errorCode: input.errorCode ?? null,
        });
      }
      await deps.emitRoleAuditEvent(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        roleId: input.roleId,
        eventType: input.eventType,
        operation: 'delete',
        result: input.result,
        roleKey: input.roleKey,
        externalRoleName: input.externalRoleName,
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });
    });
  };

  const deleteRoleFromDatabase = async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
  }) => {
    await deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;', [
        input.actor.instanceId,
        input.roleId,
      ]);
      await client.query('DELETE FROM iam.roles WHERE instance_id = $1 AND id = $2::uuid;', [
        input.actor.instanceId,
        input.roleId,
      ]);

      await deps.emitActivityLog(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        eventType: 'role.deleted',
        result: 'success',
        payload: {
          role_id: input.roleId,
          role_key: input.roleKey,
        },
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });
      await deps.emitRoleAuditEvent(client, {
        instanceId: input.actor.instanceId,
        accountId: input.actor.actorAccountId,
        roleId: input.roleId,
        eventType: 'role.sync_succeeded',
        operation: 'delete',
        result: 'success',
        roleKey: input.roleKey,
        externalRoleName: input.externalRoleName,
        requestId: input.actor.requestId,
        traceId: input.actor.traceId,
      });
      await deps.notifyPermissionInvalidation(client, {
        instanceId: input.actor.instanceId,
        trigger: 'role_deleted',
      });
    });
  };

  return {
    deleteRoleFromDatabase,
    markDeleteRoleSyncState,
    markRoleSyncState,
    persistCreatedRole,
    persistUpdatedRole,
    resolveDeletableRole,
    resolveMutableRole,
  };
};
