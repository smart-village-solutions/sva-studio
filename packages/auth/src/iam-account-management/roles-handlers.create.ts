import { createCreateRoleHandlerInternal } from '@sva/iam-admin';

import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey, toPayloadHash } from './api-helpers.js';
import {
  buildRoleSyncFailure,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { loadRoleListItemById } from './role-query.js';
import { createRoleSchema } from './schemas.js';
import {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
} from './shared-activity.js';
import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
import {
  iamRoleSyncCounter,
  iamUserOperationsCounter,
  logger,
  trackKeycloakCall,
} from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import {
  buildRoleAttributes,
  requireRoleIdentityProvider,
  resolveRoleMutationActor,
  type RoleMutationActor,
} from './roles-handlers.shared.js';

const persistCreatedRole = async (input: {
  actor: RoleMutationActor;
  roleKey: string;
  displayName: string;
  externalRoleName: string;
  description?: string;
  roleLevel: number;
  permissionIds: readonly string[];
}) => {
  return withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const inserted = await client.query<{ id: string }>(
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

    await emitRoleAuditEvent(client, {
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

    await emitActivityLog(client, {
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

    await emitRoleAuditEvent(client, {
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

    await notifyPermissionInvalidation(client, {
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
};

export const createRoleInternal = createCreateRoleHandlerInternal({
  asApiItem,
  buildRoleAttributes,
  buildRoleSyncFailure,
  completeIdempotency,
  createApiError,
  iamRoleSyncCounter,
  iamUserOperationsCounter,
  jsonResponse,
  logger,
  mapRoleSyncErrorCode,
  parseCreateRoleBody: (request) => parseRequestBody(request, createRoleSchema),
  persistCreatedRole,
  requireIdempotencyKey,
  requireRoleIdentityProvider,
  reserveIdempotency,
  resolveRoleMutationActor,
  sanitizeRoleErrorMessage,
  toPayloadHash,
  trackKeycloakCall,
});
