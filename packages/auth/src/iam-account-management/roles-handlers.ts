import type { ApiErrorResponse, IamPermission, IamRoleListItem, IamRoleSyncState } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse, type QueryClient } from '../shared/db-helpers.js';
import { isUuid } from '../shared/input-readers.js';

import { ADMIN_ROLES, SYSTEM_ADMIN_ROLES } from './constants.js';
import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from './api-helpers.js';
import { classifyIamDiagnosticError, createActorResolutionDetails } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  buildRoleSyncFailure,
  getRoleDisplayName,
  getRoleExternalName,
  mapRoleListItem,
  mapRoleSyncErrorCode,
  sanitizeRoleErrorMessage,
} from './role-audit.js';
import {
  completeIdempotency,
  emitActivityLog,
  emitRoleAuditEvent,
  iamRoleSyncCounter,
  iamUserOperationsCounter,
  logger,
  notifyPermissionInvalidation,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  resolveIdentityProvider,
  setRoleSyncState,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import { validateCsrf } from './csrf.js';
import { createRoleSchema, updateRoleSchema } from './schemas.js';
import type { ManagedBy, ManagedRoleRow } from './types.js';

const loadRoleListItems = async (
  client: QueryClient,
  instanceId: string
): Promise<readonly IamRoleListItem[]> => {
  const result = await client.query<{
    id: string;
    role_key: string;
    role_name: string;
    display_name: string | null;
    external_role_name: string | null;
    managed_by: ManagedBy;
    description: string | null;
    is_system_role: boolean;
    role_level: number;
    member_count: number;
    sync_state: IamRoleSyncState;
    last_synced_at: string | null;
    last_error_code: string | null;
    permission_rows: Array<{ id: string; permission_key: string; description: string | null }> | null;
  }>(
    `
SELECT
  r.id,
  r.role_key,
  r.role_name,
  r.display_name,
  r.external_role_name,
  r.managed_by,
  r.description,
  r.is_system_role,
  r.role_level,
  COUNT(DISTINCT ar.account_id)::int AS member_count,
  r.sync_state,
  r.last_synced_at::text,
  r.last_error_code,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', p.id,
        'permission_key', p.permission_key,
        'description', p.description
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) AS permission_rows
FROM iam.roles r
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = r.instance_id
 AND ar.role_id = r.id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE r.instance_id = $1
GROUP BY r.id
ORDER BY r.role_level DESC, COALESCE(r.display_name, r.role_name) ASC;
`,
    [instanceId]
  );

  return result.rows.map(mapRoleListItem);
};

const loadRoleById = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<ManagedRoleRow | undefined> => {
  const result = await client.query<ManagedRoleRow>(
    `
SELECT
  id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at::text,
  last_error_code
FROM iam.roles
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.roleId]
  );
  return result.rows[0];
};

const loadRoleListItemById = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<IamRoleListItem | undefined> => {
  const result = await client.query<{
    id: string;
    role_key: string;
    role_name: string;
    display_name: string | null;
    external_role_name: string | null;
    managed_by: ManagedBy;
    description: string | null;
    is_system_role: boolean;
    role_level: number;
    member_count: number;
    sync_state: IamRoleSyncState;
    last_synced_at: string | null;
    last_error_code: string | null;
    permission_rows: Array<{ id: string; permission_key: string; description: string | null }> | null;
  }>(
    `
SELECT
  r.id,
  r.role_key,
  r.role_name,
  r.display_name,
  r.external_role_name,
  r.managed_by,
  r.description,
  r.is_system_role,
  r.role_level,
  COUNT(DISTINCT ar.account_id)::int AS member_count,
  r.sync_state,
  r.last_synced_at::text,
  r.last_error_code,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', p.id,
        'permission_key', p.permission_key,
        'description', p.description
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) AS permission_rows
FROM iam.roles r
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = r.instance_id
 AND ar.role_id = r.id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE r.instance_id = $1
  AND r.id = $2::uuid
GROUP BY r.id
LIMIT 1;
`,
    [input.instanceId, input.roleId]
  );
  const row = result.rows[0];
  return row ? mapRoleListItem(row) : undefined;
};

const loadPermissions = async (
  client: QueryClient,
  instanceId: string
): Promise<readonly IamPermission[]> => {
  const result = await client.query<{
    id: string;
    instance_id: string;
    permission_key: string;
    description: string | null;
  }>(
    `
SELECT
  p.id,
  p.instance_id,
  p.permission_key,
  p.description
FROM iam.permissions p
WHERE p.instance_id = $1
ORDER BY p.permission_key ASC;
`,
    [instanceId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    instanceId: row.instance_id,
    permissionKey: row.permission_key,
    ...(row.description ? { description: row.description } : {}),
  }));
};

export const listRolesInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const roles = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleListItems(client, actorResolution.actor.instanceId)
    );
    return jsonResponse(
      200,
      asApiList(roles, { page: 1, pageSize: roles.length, total: roles.length }, actorResolution.actor.requestId)
    );
  } catch (error) {
    const classified = classifyIamDiagnosticError(
      error,
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
    return createApiError(classified.status, classified.code, classified.message, actorResolution.actor.requestId, classified.details);
  }
};

export const listPermissionsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const permissions = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadPermissions(client, actorResolution.actor.instanceId)
    );
    return jsonResponse(
      200,
      asApiList(
        permissions,
        { page: 1, pageSize: Math.max(1, permissions.length), total: permissions.length },
        actorResolution.actor.requestId
      )
    );
  } catch (error) {
    const classified = classifyIamDiagnosticError(
      error,
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
    return createApiError(classified.status, classified.code, classified.message, actorResolution.actor.requestId, classified.details);
  }
};

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

export const updateRoleInternal = async (
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
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const roleId = readPathSegment(request, 4);
  if (!roleId || !isUuid(roleId)) {
    return createApiError(400, 'invalid_request', 'Ungültige roleId.', actorResolution.actor.requestId);
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

  const parsed = await parseRequestBody(request, updateRoleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();

  try {
    const existing = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actorResolution.actor.instanceId, roleId })
    );

    if (!existing) {
      return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actorResolution.actor.requestId);
    }
    if (existing.is_system_role) {
      return createApiError(
        409,
        'conflict',
        'System-Rollen können nicht geändert werden.',
        actorResolution.actor.requestId
      );
    }
    if (existing.managed_by !== 'studio') {
      return createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht geändert werden.',
        actorResolution.actor.requestId
      );
    }

    const nextDisplayName = parsed.data.displayName?.trim() || getRoleDisplayName(existing);
    const nextDescription = parsed.data.description ?? existing.description ?? undefined;
    const nextRoleLevel = parsed.data.roleLevel ?? existing.role_level;
    const externalRoleName = getRoleExternalName(existing);
    const shouldSyncIdentityProvider =
      parsed.data.retrySync === true ||
      (parsed.data.displayName !== undefined && nextDisplayName !== getRoleDisplayName(existing)) ||
      (parsed.data.description !== undefined && nextDescription !== (existing.description ?? undefined));
    const syncedIdentityProvider = shouldSyncIdentityProvider ? identityProvider : null;

    if (shouldSyncIdentityProvider) {
      if (!syncedIdentityProvider) {
        return createApiError(
          503,
          'keycloak_unavailable',
          'Keycloak Admin API ist nicht konfiguriert.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'IDP_UNAVAILABLE' },
          }
        );
      }

      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await setRoleSyncState(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
          syncState: 'pending',
          errorCode: null,
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_started',
          operation: parsed.data.retrySync ? 'retry' : 'update',
          result: 'success',
          roleKey: existing.role_key,
          externalRoleName,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });

      try {
        await trackKeycloakCall('update_role', () =>
          syncedIdentityProvider.provider.updateRole(externalRoleName, {
            description: nextDescription,
            attributes: {
              managedBy: 'studio',
              instanceId: actorResolution.actor.instanceId,
              roleKey: existing.role_key,
              displayName: nextDisplayName,
            },
          })
        );
      } catch (error) {
        const errorCode = mapRoleSyncErrorCode(error);
        iamRoleSyncCounter.add(1, {
          operation: parsed.data.retrySync ? 'retry' : 'update',
          result: 'failure',
          error_code: errorCode,
        });
        await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: actorResolution.actor.instanceId,
            roleId,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_failed',
            operation: parsed.data.retrySync ? 'retry' : 'update',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        });
        return buildRoleSyncFailure({
          error,
          requestId: actorResolution.actor.requestId,
          fallbackMessage: 'Rolle konnte nicht mit Keycloak synchronisiert werden.',
          roleId,
        });
      }
    }

    try {
      const roleItem = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await client.query(
          shouldSyncIdentityProvider
            ? `
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
`
            : `
UPDATE iam.roles
SET
  display_name = $3,
  description = $4,
  role_level = $5,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
          [actorResolution.actor.instanceId, roleId, nextDisplayName, nextDescription ?? null, nextRoleLevel]
        );

        if (parsed.data.permissionIds) {
          await client.query(
            'DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;',
            [actorResolution.actor.instanceId, roleId]
          );
          if (parsed.data.permissionIds.length > 0) {
            await client.query(
              `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1::uuid, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
              [actorResolution.actor.instanceId, roleId, parsed.data.permissionIds]
            );
          }
        }

        await emitActivityLog(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          eventType: 'role.updated',
          result: 'success',
          payload: {
            role_id: roleId,
            role_key: existing.role_key,
            display_name: nextDisplayName,
          },
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        if (shouldSyncIdentityProvider) {
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_succeeded',
            operation: parsed.data.retrySync ? 'retry' : 'update',
            result: 'success',
            roleKey: existing.role_key,
            externalRoleName,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        }
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          trigger: 'role_updated',
        });

        const updatedRole = await loadRoleListItemById(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
        });
        if (!updatedRole) {
          throw new Error('role_load_failed');
        }
        return updatedRole;
      });

      if (shouldSyncIdentityProvider) {
        iamRoleSyncCounter.add(1, {
          operation: parsed.data.retrySync ? 'retry' : 'update',
          result: 'success',
          error_code: 'none',
        });
      }
      return jsonResponse(200, asApiItem(roleItem, actorResolution.actor.requestId));
    } catch (error) {
      if (shouldSyncIdentityProvider && syncedIdentityProvider) {
        try {
          await trackKeycloakCall('update_role_compensation', () =>
            syncedIdentityProvider.provider.updateRole(externalRoleName, {
              description: existing.description ?? undefined,
              attributes: {
                managedBy: 'studio',
                instanceId: actorResolution.actor.instanceId,
                roleKey: existing.role_key,
                displayName: getRoleDisplayName(existing),
              },
            })
          );
        } catch {
          await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
            await setRoleSyncState(client, {
              instanceId: actorResolution.actor.instanceId,
              roleId,
              syncState: 'failed',
              errorCode: 'COMPENSATION_FAILED',
            });
            await emitRoleAuditEvent(client, {
              instanceId: actorResolution.actor.instanceId,
              accountId: actorResolution.actor.actorAccountId,
              roleId,
              eventType: 'role.sync_failed',
              operation: 'update',
              result: 'failure',
              roleKey: existing.role_key,
              externalRoleName,
              errorCode: 'COMPENSATION_FAILED',
              requestId: actorResolution.actor.requestId,
              traceId: actorResolution.actor.traceId,
            });
          });
          iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'COMPENSATION_FAILED' });
          return createApiError(
            500,
            'internal_error',
            'Rolle konnte nicht konsistent aktualisiert werden.',
            actorResolution.actor.requestId,
            {
              syncState: 'failed',
              syncError: { code: 'COMPENSATION_FAILED' },
            }
          );
        }

        await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: actorResolution.actor.instanceId,
            roleId,
            syncState: 'failed',
            errorCode: 'DB_WRITE_FAILED',
          });
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_failed',
            operation: 'update',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode: 'DB_WRITE_FAILED',
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        });
        iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'DB_WRITE_FAILED' });
        logger.error('Role update database write failed after successful Keycloak update', {
          operation: 'update_role',
          instance_id: actorResolution.actor.instanceId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          role_id: roleId,
          role_key: existing.role_key,
          error: sanitizeRoleErrorMessage(error),
        });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht aktualisiert werden.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'DB_WRITE_FAILED' },
          }
        );
      }

      logger.error('Role update database write failed without identity provider sync', {
        operation: 'update_role',
        instance_id: actorResolution.actor.instanceId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        role_id: roleId,
        role_key: existing.role_key,
        error: sanitizeRoleErrorMessage(error),
      });
      return createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actorResolution.actor.requestId);
    }
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actorResolution.actor.requestId);
  }
};

export const deleteRoleInternal = async (
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
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const roleId = readPathSegment(request, 4);
  if (!roleId || !isUuid(roleId)) {
    return createApiError(400, 'invalid_request', 'Ungültige roleId.', actorResolution.actor.requestId);
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

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId,
      {
        syncState: 'failed',
        syncError: { code: 'IDP_UNAVAILABLE' },
      }
    );
  }

  try {
    const existing = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actorResolution.actor.instanceId, roleId })
    );

    if (!existing) {
      return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actorResolution.actor.requestId);
    }
    if (existing.is_system_role) {
      return createApiError(
        409,
        'conflict',
        'System-Rollen können nicht gelöscht werden.',
        actorResolution.actor.requestId
      );
    }
    if (existing.managed_by !== 'studio') {
      return createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht gelöscht werden.',
        actorResolution.actor.requestId
      );
    }

    const dependency = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const result = await client.query<{ used: number }>(
        `
SELECT COUNT(*)::int AS used
FROM iam.account_roles
WHERE instance_id = $1
  AND role_id = $2::uuid;
`,
        [actorResolution.actor.instanceId, roleId]
      );
      return result.rows[0]?.used ?? 0;
    });
    if (dependency > 0) {
      return createApiError(
        409,
        'conflict',
        'Rolle wird noch von Nutzern verwendet.',
        actorResolution.actor.requestId
      );
    }

    const externalRoleName = getRoleExternalName(existing);

    await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      await setRoleSyncState(client, {
        instanceId: actorResolution.actor.instanceId,
        roleId,
        syncState: 'pending',
        errorCode: null,
      });
      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_started',
        operation: 'delete',
        result: 'success',
        roleKey: existing.role_key,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });
    });

    try {
      await trackKeycloakCall('delete_role', () => identityProvider.provider.deleteRole(externalRoleName));
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError && error.statusCode === 404)) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: actorResolution.actor.instanceId,
            roleId,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_failed',
            operation: 'delete',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        });
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: errorCode });
        return buildRoleSyncFailure({
          error,
          requestId: actorResolution.actor.requestId,
          fallbackMessage: 'Rolle konnte nicht gelöscht werden.',
          roleId,
        });
      }
    }

    try {
      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1 AND role_id = $2::uuid;', [
          actorResolution.actor.instanceId,
          roleId,
        ]);
        await client.query('DELETE FROM iam.roles WHERE instance_id = $1 AND id = $2::uuid;', [
          actorResolution.actor.instanceId,
          roleId,
        ]);

        await emitActivityLog(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          eventType: 'role.deleted',
          result: 'success',
          payload: {
            role_id: roleId,
            role_key: existing.role_key,
          },
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_succeeded',
          operation: 'delete',
          result: 'success',
          roleKey: existing.role_key,
          externalRoleName,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          trigger: 'role_deleted',
        });
      });
    } catch {
      try {
        await trackKeycloakCall('create_role_compensation', () =>
          identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: existing.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: actorResolution.actor.instanceId,
              roleKey: existing.role_key,
              displayName: getRoleDisplayName(existing),
            },
          })
        );
      } catch (compensationError) {
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'COMPENSATION_FAILED' });
        logger.error('Role delete compensation failed', {
          operation: 'delete_role_compensation',
          instance_id: actorResolution.actor.instanceId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          role_id: roleId,
          role_key: existing.role_key,
          error: sanitizeRoleErrorMessage(compensationError),
        });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent gelöscht werden.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
      }

      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await setRoleSyncState(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
          syncState: 'failed',
          errorCode: 'DB_WRITE_FAILED',
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_failed',
          operation: 'delete',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode: 'DB_WRITE_FAILED',
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });
      iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'DB_WRITE_FAILED' });
      return createApiError(
        500,
        'internal_error',
        'Rolle konnte nicht gelöscht werden.',
        actorResolution.actor.requestId,
        {
          syncState: 'failed',
          syncError: { code: 'DB_WRITE_FAILED' },
        }
      );
    }

    iamRoleSyncCounter.add(1, { operation: 'delete', result: 'success', error_code: 'none' });
    return jsonResponse(
      200,
      asApiItem(
        {
          id: roleId,
          roleKey: existing.role_key,
          roleName: getRoleDisplayName(existing),
          externalRoleName,
          syncState: 'synced' as const,
        },
        actorResolution.actor.requestId
      )
    );
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', actorResolution.actor.requestId);
  }
};
