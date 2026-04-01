import type { ApiErrorResponse } from '@sva/core';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
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

const CREATE_ROLE_ENDPOINT = 'POST:/api/v1/iam/roles';

const buildCreateRoleUnavailableBody = (requestId?: string): ApiErrorResponse => ({
  error: {
    code: 'keycloak_unavailable',
    message: 'Keycloak Admin API ist nicht konfiguriert.',
    details: {
      syncState: 'failed',
      syncError: { code: 'IDP_UNAVAILABLE' },
    },
  },
  ...(requestId ? { requestId } : {}),
});

const completeCreateRoleIdempotency = async (input: {
  actor: RoleMutationActor;
  idempotencyKey: string;
  status: 'COMPLETED' | 'FAILED';
  responseStatus: number;
  responseBody: unknown;
}) => {
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId,
    endpoint: CREATE_ROLE_ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    responseStatus: input.responseStatus,
    responseBody: input.responseBody,
  });
};

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

const buildCreateRoleDbWriteFailureBody = (requestId?: string): ApiErrorResponse => ({
  error: {
    code: 'conflict',
    message: 'Rolle konnte nicht erstellt werden.',
    details: {
      syncState: 'failed',
      syncError: { code: 'DB_WRITE_FAILED' },
    },
  },
  ...(requestId ? { requestId } : {}),
});

export const createRoleInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const resolvedActor = await resolveRoleMutationActor(request, ctx);
  if ('response' in resolvedActor) {
    return resolvedActor.response;
  }

  const { actor } = resolvedActor;
  const idempotencyKey = requireIdempotencyKey(request, actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createRoleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint: CREATE_ROLE_ENDPOINT,
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
  }

  const identityProvider = requireRoleIdentityProvider(actor.requestId);
  if (identityProvider instanceof Response) {
    const responseBody = buildCreateRoleUnavailableBody(actor.requestId);
    await completeCreateRoleIdempotency({
      actor,
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 503,
      responseBody,
    });
    return jsonResponse(503, responseBody);
  }

  const roleKey = parsed.data.roleName;
  const displayName = parsed.data.displayName?.trim() || roleKey;
  const externalRoleName = roleKey;
  let createdInIdentityProvider = false;

  try {
    await trackKeycloakCall('create_role', () =>
      identityProvider.provider.createRole({
        externalName: externalRoleName,
        description: parsed.data.description ?? undefined,
        attributes: buildRoleAttributes({
          instanceId: actor.instanceId,
          roleKey,
          displayName,
        }),
      })
    );
    createdInIdentityProvider = true;

    const role = await persistCreatedRole({
      actor,
      roleKey,
      displayName,
      externalRoleName,
      description: parsed.data.description ?? undefined,
      roleLevel: parsed.data.roleLevel,
      permissionIds: parsed.data.permissionIds,
    });

    iamUserOperationsCounter.add(1, { action: 'create_role', result: 'success' });
    iamRoleSyncCounter.add(1, { operation: 'create', result: 'success', error_code: 'none' });

    const responseBody = asApiItem(role, actor.requestId);
    await completeCreateRoleIdempotency({
      actor,
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });
    return jsonResponse(201, responseBody);
  } catch (error) {
    if (createdInIdentityProvider) {
      try {
        await trackKeycloakCall('delete_role_compensation', () =>
          identityProvider.provider.deleteRole(externalRoleName)
        );
      } catch (compensationError) {
        iamRoleSyncCounter.add(1, {
          operation: 'create',
          result: 'failure',
          error_code: 'COMPENSATION_FAILED',
        });
        logger.error('Role create compensation failed', {
          operation: 'create_role_compensation',
          instance_id: actor.instanceId,
          request_id: actor.requestId,
          trace_id: actor.traceId,
          role_key: roleKey,
          external_role_name: externalRoleName,
          error_code: 'COMPENSATION_FAILED',
          error: sanitizeRoleErrorMessage(compensationError),
        });
        const responseBody = createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent erstellt werden.',
          actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
        await completeCreateRoleIdempotency({
          actor,
          idempotencyKey: idempotencyKey.key,
          status: 'FAILED',
          responseStatus: 500,
          responseBody: await responseBody.clone().json(),
        });
        return responseBody;
      }

      iamRoleSyncCounter.add(1, {
        operation: 'create',
        result: 'failure',
        error_code: 'DB_WRITE_FAILED',
      });
      const responseBody = buildCreateRoleDbWriteFailureBody(actor.requestId);
      await completeCreateRoleIdempotency({
        actor,
        idempotencyKey: idempotencyKey.key,
        status: 'FAILED',
        responseStatus: 409,
        responseBody,
      });
      return jsonResponse(409, responseBody);
    }

    iamUserOperationsCounter.add(1, { action: 'create_role', result: 'failure' });
    iamRoleSyncCounter.add(1, {
      operation: 'create',
      result: 'failure',
      error_code: mapRoleSyncErrorCode(error),
    });
    const failureResponse = buildRoleSyncFailure({
      error,
      requestId: actor.requestId,
      fallbackMessage: 'Rolle konnte nicht erstellt werden.',
    });
    await completeCreateRoleIdempotency({
      actor,
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: failureResponse.status,
      responseBody: await failureResponse.clone().json(),
    });
    return failureResponse;
  }
};
