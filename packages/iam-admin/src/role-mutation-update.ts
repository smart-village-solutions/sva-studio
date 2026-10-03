import { isProtectedTenantRole, isRootOnlyRole } from './role-governance.js';
import { loadRoleById, loadRoleListItemById } from './role-query.js';
import {
  insertRolePermissionAssignments,
  normalizeAssignmentsForPersistence,
  normalizeRolePermissionAssignments,
} from './role-mutation-permissions.js';
import type { RolePermissionAssignmentInput } from './role-mutation-permissions.js';
import type {
  RoleMutationPersistenceActor,
  RoleMutationPersistenceDeps,
  MutableRole,
} from './role-mutation-persistence.js';

export const resolveMutableRole =
  (deps: RoleMutationPersistenceDeps) =>
  async (actor: RoleMutationPersistenceActor, roleId: string): Promise<MutableRole | Response> => {
    const existing = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actor.instanceId, roleId })
    );

    if (!existing) {
      return deps.createApiError(404, 'not_found', 'Rolle nicht gefunden.', actor.requestId);
    }
    if ((existing.is_system_role && isProtectedTenantRole(existing)) || isRootOnlyRole(existing)) {
      return deps.createApiError(
        409,
        'conflict',
        'System-Rollen können nicht geändert werden.',
        actor.requestId
      );
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

export const markRoleSyncState =
  (deps: RoleMutationPersistenceDeps) =>
  async (input: {
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

export const persistUpdatedRole =
  (deps: RoleMutationPersistenceDeps) =>
  async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly existing: MutableRole;
    readonly displayName: string;
    readonly description?: string;
    readonly roleLevel: number;
    readonly externalRoleName: string;
    readonly permissionIds?: readonly string[];
    readonly permissionAssignments?: readonly RolePermissionAssignmentInput[];
    readonly operation: 'update' | 'retry';
  }) =>
    deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      const permissionAssignments =
        input.permissionIds || input.permissionAssignments
          ? await normalizeAssignmentsForPersistence(
              client,
              input.actor.instanceId,
              normalizeRolePermissionAssignments(input.permissionIds, input.permissionAssignments)
            )
          : undefined;
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
        [
          input.actor.instanceId,
          input.roleId,
          input.displayName,
          input.description ?? null,
          input.roleLevel,
        ]
      );

      if (permissionAssignments) {
        await client.query(
          'DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;',
          [input.actor.instanceId, input.roleId]
        );
        await insertRolePermissionAssignments(
          client,
          input.actor.instanceId,
          input.roleId,
          permissionAssignments
        );
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
