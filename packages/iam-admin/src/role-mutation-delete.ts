import { isProtectedTenantRole, isRootOnlyRole } from './role-governance.js';
import { loadRoleById } from './role-query.js';
import type { QueryClient } from './query-client.js';
import type {
  RoleMutationPersistenceActor,
  RoleMutationPersistenceDeps,
  MutableRole,
} from './role-mutation-persistence.js';

type DeletedRoleAssignmentCounts = Readonly<{
  removedAccountRoleAssignments: number;
  removedGroupRoleAssignments: number;
}>;

const emitDeleteSuccessEvents = async (
  deps: RoleMutationPersistenceDeps,
  client: QueryClient,
  input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
    readonly deletedAssignments: DeletedRoleAssignmentCounts;
  }
) => {
  await deps.emitActivityLog(client, {
    instanceId: input.actor.instanceId,
    accountId: input.actor.actorAccountId,
    eventType: 'role.deleted',
    result: 'success',
    payload: {
      role_id: input.roleId,
      role_key: input.roleKey,
      removed_account_role_assignments: input.deletedAssignments.removedAccountRoleAssignments,
      removed_group_role_assignments: input.deletedAssignments.removedGroupRoleAssignments,
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
};

const deleteRoleAssignments = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly roleId: string;
  }
): Promise<DeletedRoleAssignmentCounts> => {
  const deletedAccountRoles = await client.query(
    'DELETE FROM iam.account_roles WHERE instance_id = $1 AND role_id = $2::uuid;',
    [input.instanceId, input.roleId]
  );
  const deletedGroupRoles = await client.query(
    'DELETE FROM iam.group_roles WHERE instance_id = $1 AND role_id = $2::uuid;',
    [input.instanceId, input.roleId]
  );

  return {
    removedAccountRoleAssignments: deletedAccountRoles.rowCount,
    removedGroupRoleAssignments: deletedGroupRoles.rowCount,
  };
};

const listDirectRoleAssignmentSubjects = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly roleId: string;
  }
): Promise<readonly string[]> => {
  const result = await client.query<{ keycloak_subject: string }>(
    `
SELECT DISTINCT a.keycloak_subject
FROM iam.account_roles ar
JOIN iam.accounts a
  ON a.instance_id = ar.instance_id
 AND a.id = ar.account_id
WHERE ar.instance_id = $1
  AND ar.role_id = $2::uuid
ORDER BY a.keycloak_subject ASC
`,
    [input.instanceId, input.roleId]
  );
  return result.rows.map((row) => row.keycloak_subject);
};

const deleteRoleRecords = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly roleId: string;
  }
) => {
  await client.query(
    'DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;',
    [input.instanceId, input.roleId]
  );
  await client.query('DELETE FROM iam.roles WHERE instance_id = $1 AND id = $2::uuid;', [
    input.instanceId,
    input.roleId,
  ]);
};

const resolveDeletableRole =
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
        'System-Rollen können nicht gelöscht werden.',
        actor.requestId
      );
    }
    if (existing.managed_by !== 'studio') {
      return deps.createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht gelöscht werden.',
        actor.requestId
      );
    }

    return existing;
  };

const markDeleteRoleSyncState =
  (deps: RoleMutationPersistenceDeps) =>
  async (input: {
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

const deleteRoleFromDatabase =
  (deps: RoleMutationPersistenceDeps) =>
  async (input: {
    readonly actor: RoleMutationPersistenceActor;
    readonly roleId: string;
    readonly roleKey: string;
    readonly externalRoleName: string;
  }) => {
    await deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      const deletedAssignments = await deleteRoleAssignments(client, {
        instanceId: input.actor.instanceId,
        roleId: input.roleId,
      });
      await deleteRoleRecords(client, {
        instanceId: input.actor.instanceId,
        roleId: input.roleId,
      });
      await emitDeleteSuccessEvents(deps, client, {
        actor: input.actor,
        roleId: input.roleId,
        roleKey: input.roleKey,
        externalRoleName: input.externalRoleName,
        deletedAssignments,
      });
      await deps.notifyPermissionInvalidation(client, {
        instanceId: input.actor.instanceId,
        trigger: 'role_deleted',
      });
    });
  };

export const createRoleDeletePersistence = (deps: RoleMutationPersistenceDeps) => ({
  deleteRoleFromDatabase: deleteRoleFromDatabase(deps),
  listDirectRoleAssignmentSubjects: async (input: {
    readonly instanceId: string;
    readonly roleId: string;
  }) =>
    deps.withInstanceScopedDb(input.instanceId, (client) =>
      listDirectRoleAssignmentSubjects(client, input)
    ),
  markDeleteRoleSyncState: markDeleteRoleSyncState(deps),
  resolveDeletableRole: resolveDeletableRole(deps),
});
