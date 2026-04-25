import { createLegacyGroupReadHandlers, loadLegacyGroupById } from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';

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
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { createGroupSchema, updateGroupSchema } from './schemas.js';
import {
  type ActorInfo,
  completeIdempotency,
  emitActivityLog,
  iamUserOperationsCounter,
  logger,
  notifyPermissionInvalidation,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  resolveRolesByIds,
  withInstanceScopedDb,
} from './shared.js';

const legacyGroupReadHandlers = createLegacyGroupReadHandlers({
  asApiItem,
  asApiList,
  consumeRateLimit,
  createApiError,
  ensureFeature,
  getFeatureFlags,
  getWorkspaceContext,
  isUuid,
  jsonResponse,
  readPathSegment,
  requireRoles,
  resolveActorInfo,
  withInstanceScopedDb,
});

const replaceGroupRoles = async (
  client: QueryClient,
  input: { instanceId: string; groupId: string; roleIds: readonly string[] }
) => {
  const uniqueRoleIds = [...new Set(input.roleIds)];
  await client.query('DELETE FROM iam.group_roles WHERE instance_id = $1 AND group_id = $2::uuid;', [
    input.instanceId,
    input.groupId,
  ]);

  if (uniqueRoleIds.length === 0) {
    return;
  }

  await client.query(
    `
INSERT INTO iam.group_roles (instance_id, group_id, role_id)
SELECT $1, $2::uuid, role_id
FROM (
  SELECT DISTINCT role_id
  FROM unnest($3::uuid[]) AS input_roles(role_id)
) AS unique_role_ids;
`,
    [input.instanceId, input.groupId, uniqueRoleIds]
  );
};

const validateRoleIds = async (
  client: QueryClient,
  input: { instanceId: string; roleIds: readonly string[] }
): Promise<boolean> => {
  const uniqueRoleIds = [...new Set(input.roleIds)];
  const roles = await resolveRolesByIds(client, { ...input, roleIds: uniqueRoleIds });
  return roles.length === uniqueRoleIds.length;
};

const createDatabaseUnavailableError = (requestId?: string): Response =>
  createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', requestId);

const readGroupIdOrError = (
  request: Request,
  requestId?: string
): { groupId: string } | { error: Response } => {
  const groupId = readPathSegment(request, 4);
  if (!groupId || !isUuid(groupId)) {
    return {
      error: createApiError(400, 'invalid_request', 'Ungültige groupId.', requestId),
    };
  }

  return { groupId };
};

const prepareGroupRequest = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  input: {
    requiredRoles: ReadonlySet<string>;
    rateScope: 'read' | 'write';
    requireActorAccountId?: boolean;
  }
): Promise<{ actor: ActorInfo } | { error: Response }> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }

  const roleCheck = requireRoles(ctx, input.requiredRoles, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: input.rateScope,
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { error: rateLimit };
  }

  if (input.requireActorAccountId && !actorResolution.actor.actorAccountId) {
    return {
      error: createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId),
    };
  }

  return actorResolution;
};

export const { getGroupInternal, listGroupsInternal } = legacyGroupReadHandlers;

export const createGroupInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await prepareGroupRequest(request, ctx, {
    requiredRoles: SYSTEM_ADMIN_ROLES,
    rateScope: 'write',
    requireActorAccountId: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  const actorAccountId = actorResolution.actor.actorAccountId;
  if (!actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createGroupSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId,
    endpoint: 'POST:/api/v1/iam/groups',
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorResolution.actor.requestId);
  }

  try {
    const responseBody = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const rolesValid = await validateRoleIds(client, {
        instanceId: actorResolution.actor.instanceId,
        roleIds: parsed.data.roleIds,
      });
      if (!rolesValid) {
        throw new Error('invalid_request:Mindestens eine Rolle existiert nicht.');
      }

      const insertResult = await client.query<{ id: string }>(
        `
INSERT INTO iam.groups (
  instance_id,
  group_key,
  display_name,
  description,
  group_type,
  is_active
)
VALUES ($1, $2, $3, $4, 'role_bundle', true)
RETURNING id;
`,
        [
          actorResolution.actor.instanceId,
          parsed.data.groupKey,
          parsed.data.displayName,
          parsed.data.description ?? null,
        ]
      );
      const groupId = insertResult.rows[0]?.id;
      if (!groupId) {
        throw new Error('database_unavailable:Gruppe konnte nicht angelegt werden.');
      }

      await replaceGroupRoles(client, {
        instanceId: actorResolution.actor.instanceId,
        groupId,
        roleIds: parsed.data.roleIds,
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorAccountId,
        eventType: 'group.created',
        result: 'success',
        payload: {
          groupId,
          roleCount: parsed.data.roleIds.length,
          groupKey: parsed.data.groupKey,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        trigger: 'group_created',
      });

      const group = await loadLegacyGroupById(client, { instanceId: actorResolution.actor.instanceId, groupId });
      if (!group) {
        throw new Error('not_found:Gruppe nicht gefunden.');
      }
      return asApiItem(group, actorResolution.actor.requestId);
    });

    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId,
      endpoint: 'POST:/api/v1/iam/groups',
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });
    iamUserOperationsCounter.add(1, { action: 'create_group', result: 'success' });
    return jsonResponse(201, responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let failureResponse: Response;
    if (message.includes('groups_instance_key_uniq')) {
      failureResponse = createApiError(
        409,
        'conflict',
        'Gruppe mit diesem Schlüssel existiert bereits.',
        actorResolution.actor.requestId
      );
    } else {
      const [code, detail] = message.split(':', 2);
      failureResponse =
        code === 'invalid_request'
          ? createApiError(400, 'invalid_request', detail, actorResolution.actor.requestId)
          : createDatabaseUnavailableError(actorResolution.actor.requestId);
    }

    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId,
      endpoint: 'POST:/api/v1/iam/groups',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: failureResponse.status,
      responseBody: await failureResponse.clone().json(),
    });
    return failureResponse;
  }
};

export const updateGroupInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await prepareGroupRequest(request, ctx, {
    requiredRoles: SYSTEM_ADMIN_ROLES,
    rateScope: 'write',
    requireActorAccountId: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const groupId = readGroupIdOrError(request, actorResolution.actor.requestId);
  if ('error' in groupId) {
    return groupId.error;
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateGroupSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  try {
    const group = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      if (parsed.data.roleIds) {
        const rolesValid = await validateRoleIds(client, {
          instanceId: actorResolution.actor.instanceId,
          roleIds: parsed.data.roleIds,
        });
        if (!rolesValid) {
          throw new Error('invalid_request:Mindestens eine Rolle existiert nicht.');
        }
      }

      const updated = await client.query<{ id: string }>(
        `
UPDATE iam.groups
SET
  display_name = COALESCE($3, display_name),
  description = COALESCE($4, description),
  is_active = COALESCE($5, is_active),
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING id;
`,
        [
          actorResolution.actor.instanceId,
          groupId.groupId,
          parsed.data.displayName ?? null,
          parsed.data.description ?? null,
          parsed.data.isActive ?? null,
        ]
      );
      if (!updated.rows[0]?.id) {
        return undefined;
      }

      if (parsed.data.roleIds) {
        await replaceGroupRoles(client, {
          instanceId: actorResolution.actor.instanceId,
          groupId: groupId.groupId,
          roleIds: parsed.data.roleIds,
        });
      }

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'group.updated',
        result: 'success',
        payload: {
          groupId: groupId.groupId,
          roleUpdate: Boolean(parsed.data.roleIds),
          isActive: parsed.data.isActive,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        trigger: 'group_updated',
      });

      return loadLegacyGroupById(client, { instanceId: actorResolution.actor.instanceId, groupId: groupId.groupId });
    });

    if (!group) {
      return createApiError(404, 'not_found', 'Gruppe nicht gefunden.', actorResolution.actor.requestId);
    }
    iamUserOperationsCounter.add(1, { action: 'update_group', result: 'success' });
    return jsonResponse(200, asApiItem(group, actorResolution.actor.requestId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const [code, detail] = message.split(':', 2);
    if (code === 'invalid_request') {
      return createApiError(400, 'invalid_request', detail, actorResolution.actor.requestId);
    }
    logger.error('IAM group update failed', {
      operation: 'update_group',
      instance_id: actorResolution.actor.instanceId,
      group_id: groupId.groupId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: message,
    });
    return createDatabaseUnavailableError(actorResolution.actor.requestId);
  }
};

export const deleteGroupInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await prepareGroupRequest(request, ctx, {
    requiredRoles: SYSTEM_ADMIN_ROLES,
    rateScope: 'write',
    requireActorAccountId: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const groupId = readGroupIdOrError(request, actorResolution.actor.requestId);
  if ('error' in groupId) {
    return groupId.error;
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  try {
    const updated = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const result = await client.query<{ id: string }>(
        `
UPDATE iam.groups
SET is_active = false, updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING id;
`,
        [actorResolution.actor.instanceId, groupId.groupId]
      );
      if (!result.rows[0]?.id) {
        return false;
      }

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'group.deleted',
        result: 'success',
        payload: {
          groupId: groupId.groupId,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        trigger: 'group_deleted',
      });

      return true;
    });

    if (!updated) {
      return createApiError(404, 'not_found', 'Gruppe nicht gefunden.', actorResolution.actor.requestId);
    }
    iamUserOperationsCounter.add(1, { action: 'delete_group', result: 'success' });
    return jsonResponse(200, asApiItem({ id: groupId.groupId }, actorResolution.actor.requestId));
  } catch {
    return createDatabaseUnavailableError(actorResolution.actor.requestId);
  }
};
