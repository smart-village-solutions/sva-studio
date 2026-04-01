import type { ApiErrorResponse } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { SYSTEM_ADMIN_ROLES } from './constants.js';
import {
  asApiItem,
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
  toPayloadHash,
} from './api-helpers.js';
import { createActorResolutionDetails } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  buildRoleSyncFailure,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import { loadRoleListItemById } from './role-query.js';
import { createRoleSchema } from './schemas.js';
import { validateCsrf } from './csrf.js';
import {
  emitActivityLog,
  emitRoleAuditEvent,
  notifyPermissionInvalidation,
} from './shared-activity.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
import {
  iamRoleSyncCounter,
  iamUserOperationsCounter,
  logger,
  trackKeycloakCall,
} from './shared-observability.js';
import { resolveIdentityProvider, withInstanceScopedDb } from './shared-runtime.js';

export const createRoleInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(
      403,
      'forbidden',
      'Akteur-Account nicht gefunden.',
      actorResolution.actor.requestId,
      createActorResolutionDetails({
        actorResolution: 'missing_actor_account',
        instanceId: actorResolution.actor.instanceId,
      })
    );
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createRoleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/roles',
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    const responseBody = {
      error: {
        code: 'keycloak_unavailable',
        message: 'Keycloak Admin API ist nicht konfiguriert.',
        details: {
          syncState: 'failed',
          syncError: { code: 'IDP_UNAVAILABLE' },
        },
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/roles',
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
        attributes: {
          managedBy: 'studio',
          instanceId: actorResolution.actor.instanceId,
          roleKey,
          displayName,
        },
      })
    );
    createdInIdentityProvider = true;

    const role = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
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
          actorResolution.actor.instanceId,
          roleKey,
          roleKey,
          displayName,
          externalRoleName,
          parsed.data.description ?? null,
          parsed.data.roleLevel,
        ]
      );
      const roleId = inserted.rows[0]?.id;
      if (!roleId) {
        throw new Error('conflict');
      }

      if (parsed.data.permissionIds.length > 0) {
        await client.query(
          `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
          [actorResolution.actor.instanceId, roleId, parsed.data.permissionIds]
        );
      }

      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_started',
        operation: 'create',
        result: 'success',
        roleKey,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'role.created',
        result: 'success',
        payload: {
          role_id: roleId,
          role_key: roleKey,
          display_name: displayName,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_succeeded',
        operation: 'create',
        result: 'success',
        roleKey,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        trigger: 'role_created',
      });

      const roleItem = await loadRoleListItemById(client, {
        instanceId: actorResolution.actor.instanceId,
        roleId,
      });
      if (!roleItem) {
        throw new Error('role_load_failed');
      }
      return roleItem;
    });
    iamUserOperationsCounter.add(1, { action: 'create_role', result: 'success' });
    iamRoleSyncCounter.add(1, { operation: 'create', result: 'success', error_code: 'none' });
    const responseBody = asApiItem(role, actorResolution.actor.requestId);
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/roles',
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
          instance_id: actorResolution.actor.instanceId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          role_key: roleKey,
          external_role_name: externalRoleName,
          error_code: 'COMPENSATION_FAILED',
          error: sanitizeRoleErrorMessage(compensationError),
        });
        const responseBody = createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent erstellt werden.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
        await completeIdempotency({
          instanceId: actorResolution.actor.instanceId,
          actorAccountId: actorResolution.actor.actorAccountId,
          endpoint: 'POST:/api/v1/iam/roles',
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
      const responseBody = {
        error: {
          code: 'conflict',
          message: 'Rolle konnte nicht erstellt werden.',
          details: {
            syncState: 'failed',
            syncError: { code: 'DB_WRITE_FAILED' },
          },
        },
        ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
      } satisfies ApiErrorResponse;
      await completeIdempotency({
        instanceId: actorResolution.actor.instanceId,
        actorAccountId: actorResolution.actor.actorAccountId,
        endpoint: 'POST:/api/v1/iam/roles',
        idempotencyKey: idempotencyKey.key,
        status: 'FAILED',
        responseStatus: 409,
        responseBody,
      });
      return jsonResponse(409, responseBody);
    }

    iamUserOperationsCounter.add(1, { action: 'create_role', result: 'failure' });
    const failureResponse = buildRoleSyncFailure({
      error,
      requestId: actorResolution.actor.requestId,
      fallbackMessage: 'Rolle konnte nicht erstellt werden.',
    });
    iamRoleSyncCounter.add(1, {
      operation: 'create',
      result: 'failure',
      error_code: mapRoleSyncErrorCode(error),
    });
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: failureResponse.status,
      responseBody: await failureResponse.clone().json(),
    });
    return failureResponse;
  }
};
