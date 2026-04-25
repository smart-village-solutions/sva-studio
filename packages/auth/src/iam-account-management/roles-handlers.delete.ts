import { createDeleteRoleHandlerInternal } from '@sva/iam-admin';

import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError } from './api-helpers.js';
import { mapRoleSyncErrorCode, sanitizeRoleErrorMessage } from './role-audit.js';
import { loadRoleById } from './role-query.js';
import {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
  setRoleSyncState,
} from './shared-activity.js';
import { iamRoleSyncCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import {
  buildRoleAttributes,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveRoleMutationActor,
  type RoleMutationActor,
} from './roles-handlers.shared.js';

type MutableRoleForDelete = NonNullable<Awaited<ReturnType<typeof loadRoleById>>>;

const resolveDeletableRole = async (
  actor: RoleMutationActor,
  roleId: string
): Promise<MutableRoleForDelete | Response> => {
  const existing = await withInstanceScopedDb(actor.instanceId, (client) =>
    loadRoleById(client, { instanceId: actor.instanceId, roleId })
  );

  if (!existing) {
    return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actor.requestId);
  }
  if (existing.is_system_role) {
    return createApiError(409, 'conflict', 'System-Rollen können nicht gelöscht werden.', actor.requestId);
  }
  if (existing.managed_by !== 'studio') {
    return createApiError(
      409,
      'conflict',
      'Extern verwaltete Rollen können im Studio nicht gelöscht werden.',
      actor.requestId
    );
  }

  const dependency = await withInstanceScopedDb(actor.instanceId, async (client) => {
    const result = await client.query<{ used: number }>(
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
    return createApiError(409, 'conflict', 'Rolle wird noch von Nutzern verwendet.', actor.requestId);
  }

  return existing;
};

const markDeleteRoleSyncState = async (input: {
  actor: RoleMutationActor;
  roleId: string;
  roleKey: string;
  externalRoleName: string;
  result: 'success' | 'failure';
  eventType: 'role.sync_started' | 'role.sync_failed' | 'role.sync_succeeded';
  errorCode?: string;
  syncState?: 'pending' | 'failed';
}) => {
  await withInstanceScopedDb(input.actor.instanceId, async (client) => {
    if (input.syncState) {
      await setRoleSyncState(client, {
        instanceId: input.actor.instanceId,
        roleId: input.roleId,
        syncState: input.syncState,
        errorCode: input.errorCode ?? null,
      });
    }
    await emitRoleAuditEvent(client, {
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
  actor: RoleMutationActor;
  roleId: string;
  roleKey: string;
  externalRoleName: string;
}) => {
  await withInstanceScopedDb(input.actor.instanceId, async (client) => {
    await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;', [
      input.actor.instanceId,
      input.roleId,
    ]);
    await client.query('DELETE FROM iam.roles WHERE instance_id = $1 AND id = $2::uuid;', [
      input.actor.instanceId,
      input.roleId,
    ]);

    await emitActivityLog(client, {
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
    await emitRoleAuditEvent(client, {
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
    await notifyPermissionInvalidation(client, {
      instanceId: input.actor.instanceId,
      trigger: 'role_deleted',
    });
  });
};

export const deleteRoleInternal = createDeleteRoleHandlerInternal({
  asApiItem,
  buildRoleAttributes,
  createApiError,
  deleteRoleFromDatabase,
  iamRoleSyncCounter,
  isIdentityRoleNotFoundError: (error) => error instanceof KeycloakAdminRequestError && error.statusCode === 404,
  jsonResponse,
  logger,
  mapRoleSyncErrorCode,
  markDeleteRoleSyncState,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveDeletableRole,
  resolveRoleMutationActor,
  sanitizeRoleErrorMessage,
  trackKeycloakCall,
});
