import { createUpdateRoleHandlerInternal } from '@sva/iam-admin';

import type { ManagedRoleRow } from './types.js';

import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError, parseRequestBody } from './api-helpers.js';
import {
  buildRoleSyncFailure,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { loadRoleById, loadRoleListItemById } from './role-query.js';
import { updateRoleSchema } from './schemas.js';
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

type MutableRole = ManagedRoleRow & {
  readonly is_system_role: boolean;
  readonly managed_by: string;
  readonly role_level: number;
  readonly role_key: string;
  readonly description: string | null;
};

const resolveMutableRole = async (
  actor: RoleMutationActor,
  roleId: string
): Promise<MutableRole | Response> => {
  const existing = await withInstanceScopedDb(actor.instanceId, (client) =>
    loadRoleById(client, { instanceId: actor.instanceId, roleId })
  );

  if (!existing) {
    return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actor.requestId);
  }
  if (existing.is_system_role) {
    return createApiError(409, 'conflict', 'System-Rollen können nicht geändert werden.', actor.requestId);
  }
  if (existing.managed_by !== 'studio') {
    return createApiError(
      409,
      'conflict',
      'Extern verwaltete Rollen können im Studio nicht geändert werden.',
      actor.requestId
    );
  }

  return existing;
};

const markRoleSyncState = async (input: {
  actor: RoleMutationActor;
  roleId: string;
  operation: 'update' | 'retry';
  result: 'success' | 'failure';
  roleKey: string;
  externalRoleName: string;
  errorCode?: string;
  syncState: 'pending' | 'failed' | 'synced';
  syncedAt?: boolean;
}) => {
  await withInstanceScopedDb(input.actor.instanceId, async (client) => {
    await setRoleSyncState(client, {
      instanceId: input.actor.instanceId,
      roleId: input.roleId,
      syncState: input.syncState,
      errorCode: input.errorCode ?? null,
      ...(input.syncedAt ? { syncedAt: true } : {}),
    });
    await emitRoleAuditEvent(client, {
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
  actor: RoleMutationActor;
  roleId: string;
  existing: MutableRole;
  displayName: string;
  description?: string;
  roleLevel: number;
  externalRoleName: string;
  permissionIds?: readonly string[];
  operation: 'update' | 'retry';
}) => {
  return withInstanceScopedDb(input.actor.instanceId, async (client) => {
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

    await emitActivityLog(client, {
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
    await emitRoleAuditEvent(client, {
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
    await notifyPermissionInvalidation(client, {
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
};

export const updateRoleInternal = createUpdateRoleHandlerInternal({
  asApiItem,
  buildRoleAttributes,
  buildRoleSyncFailure,
  createApiError,
  iamRoleSyncCounter,
  jsonResponse,
  logger,
  mapRoleSyncErrorCode,
  markRoleSyncState,
  parseUpdateRoleBody: (request) => parseRequestBody(request, updateRoleSchema),
  persistUpdatedRole,
  requireRoleId,
  requireRoleIdentityProvider,
  resolveMutableRole,
  resolveRoleMutationActor,
  sanitizeRoleErrorMessage,
  trackKeycloakCall,
});
