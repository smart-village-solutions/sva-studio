import { createRoleKeyCandidate } from './role-key.js';
import { loadRoleListItemById } from './role-query.js';
import {
  insertRolePermissionAssignments,
  normalizeAssignmentsForPersistence,
  normalizeRolePermissionAssignments,
} from './role-mutation-permissions.js';
import type { RolePermissionAssignmentInput } from './role-mutation-permissions.js';
import type {
  RoleMutationPersistenceActor,
  RoleMutationPersistenceDeps,
} from './role-mutation-persistence.js';
import type { QueryClient } from './query-client.js';

const allocateRoleKey = async (
  client: QueryClient,
  instanceId: string,
  requestedRoleKey: string
): Promise<string> => {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [
    `iam.role-key:${instanceId}:${requestedRoleKey}`,
  ]);
  const existingKeys = await client.query<{ readonly role_key: string }>(
    `
SELECT role_key
FROM iam.roles
WHERE instance_id = $1
  AND (role_key = $2 OR left(role_key, length($2) + 1) = $2 || '_');
`,
    [instanceId, requestedRoleKey]
  );
  const occupiedKeys = new Set(existingKeys.rows.map((row) => row.role_key));
  let sequence = 1;
  while (occupiedKeys.has(createRoleKeyCandidate(requestedRoleKey, sequence))) {
    sequence += 1;
  }
  return createRoleKeyCandidate(requestedRoleKey, sequence);
};

type CreateRoleInput = {
  readonly actor: RoleMutationPersistenceActor;
  readonly roleKey: string;
  readonly generateUniqueRoleKey?: boolean;
  readonly displayName: string;
  readonly externalRoleName: string;
  readonly description?: string;
  readonly roleLevel: number;
  readonly permissionIds: readonly string[];
  readonly permissionAssignments?: readonly RolePermissionAssignmentInput[];
};

const emitCreatedRoleEvents = async (
  deps: RoleMutationPersistenceDeps,
  client: QueryClient,
  input: CreateRoleInput,
  roleId: string,
  roleKey: string
): Promise<void> => {
  await deps.emitRoleAuditEvent(client, {
    instanceId: input.actor.instanceId,
    accountId: input.actor.actorAccountId,
    roleId,
    eventType: 'role.sync_started',
    operation: 'create',
    result: 'success',
    roleKey,
    externalRoleName: input.generateUniqueRoleKey ? roleKey : input.externalRoleName,
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
      role_key: roleKey,
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
    roleKey,
    externalRoleName: input.generateUniqueRoleKey ? roleKey : input.externalRoleName,
    requestId: input.actor.requestId,
    traceId: input.actor.traceId,
  });
};

export const persistCreatedRole =
  (deps: RoleMutationPersistenceDeps) => async (input: CreateRoleInput) =>
    deps.withInstanceScopedDb(input.actor.instanceId, async (client) => {
      const roleKey = input.generateUniqueRoleKey
        ? await allocateRoleKey(client, input.actor.instanceId, input.roleKey)
        : input.roleKey;

      const permissionAssignments = await normalizeAssignmentsForPersistence(
        client,
        input.actor.instanceId,
        normalizeRolePermissionAssignments(input.permissionIds, input.permissionAssignments)
      );

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
          roleKey,
          roleKey,
          input.displayName,
          input.generateUniqueRoleKey ? roleKey : input.externalRoleName,
          input.description ?? null,
          input.roleLevel,
        ]
      );
      const roleId = inserted.rows[0]?.id;
      if (!roleId) {
        throw new Error('conflict');
      }

      await insertRolePermissionAssignments(
        client,
        input.actor.instanceId,
        roleId,
        permissionAssignments
      );

      await emitCreatedRoleEvents(deps, client, input, roleId, roleKey);

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
