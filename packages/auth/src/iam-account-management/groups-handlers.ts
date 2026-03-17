import type { IamGroupDetail, IamGroupListItem, IamUserGroupAssignment } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server';
import { jsonResponse, type QueryClient } from '../shared/db-helpers';
import { isUuid } from '../shared/input-readers';

import { ADMIN_ROLES, SYSTEM_ADMIN_ROLES } from './constants';
import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from './api-helpers';
import { validateCsrf } from './csrf';
import { ensureFeature, getFeatureFlags } from './feature-flags';
import { consumeRateLimit } from './rate-limit';
import { createGroupSchema, updateGroupSchema } from './schemas';
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
} from './shared';

type GroupRoleRow = {
  role_id: string;
  role_key: string;
  role_name: string;
};

type GroupListRow = {
  id: string;
  group_key: string;
  display_name: string;
  description: string | null;
  group_type: 'role_bundle';
  is_active: boolean;
  member_count: number;
  role_rows: GroupRoleRow[] | null;
};

type GroupMemberRow = {
  account_id: string;
  group_id: string;
  group_key: string;
  display_name: string;
  group_type: 'role_bundle';
  origin: 'manual' | 'seed' | 'sync';
  valid_from: string | null;
  valid_to: string | null;
};

type GroupDetailRow = GroupListRow & {
  member_rows: GroupMemberRow[] | null;
};

const mapGroupListItem = (row: GroupListRow): IamGroupListItem => ({
  id: row.id,
  groupKey: row.group_key,
  displayName: row.display_name,
  description: row.description ?? undefined,
  groupType: row.group_type,
  isActive: row.is_active,
  memberCount: Number(row.member_count),
  roles:
    row.role_rows?.map((role) => ({
      roleId: role.role_id,
      roleKey: role.role_key,
      roleName: role.role_name,
    })) ?? [],
});

const mapGroupMemberRows = (rows: GroupMemberRow[] | null): readonly IamUserGroupAssignment[] =>
  rows?.map((row) => ({
    accountId: row.account_id,
    groupId: row.group_id,
    groupKey: row.group_key,
    displayName: row.display_name,
    groupType: row.group_type,
    origin: row.origin,
    validFrom: row.valid_from ?? undefined,
    validTo: row.valid_to ?? undefined,
  })) ?? [];

const mapGroupDetail = (row: GroupDetailRow): IamGroupDetail => ({
  ...mapGroupListItem(row),
  members: mapGroupMemberRows(row.member_rows),
});

const GROUP_LIST_QUERY = `
SELECT
  g.id,
  g.group_key,
  g.display_name,
  g.description,
  g.group_type,
  g.is_active,
  COUNT(DISTINCT ag.account_id)::int AS member_count,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'role_id', r.id,
        'role_key', r.role_key,
        'role_name', COALESCE(r.display_name, r.role_name)
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows
FROM iam.groups g
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
LEFT JOIN iam.roles r
  ON r.instance_id = gr.instance_id
 AND r.id = gr.role_id
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
 AND (ag.valid_to IS NULL OR ag.valid_to > NOW())
WHERE g.instance_id = $1
GROUP BY g.id
ORDER BY g.is_active DESC, g.display_name ASC;
`;

const GROUP_DETAIL_QUERY = `
SELECT
  g.id,
  g.group_key,
  g.display_name,
  g.description,
  g.group_type,
  g.is_active,
  COUNT(DISTINCT ag.account_id)::int AS member_count,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'role_id', r.id,
        'role_key', r.role_key,
        'role_name', COALESCE(r.display_name, r.role_name)
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'group_id', g.id,
        'account_id', ag.account_id,
        'group_key', g.group_key,
        'display_name', g.display_name,
        'group_type', g.group_type,
        'origin', ag.origin,
        'valid_from', ag.valid_from::text,
        'valid_to', ag.valid_to::text
      )
    ) FILTER (WHERE ag.account_id IS NOT NULL),
    '[]'::json
  ) AS member_rows
FROM iam.groups g
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
LEFT JOIN iam.roles r
  ON r.instance_id = gr.instance_id
 AND r.id = gr.role_id
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
 AND (ag.valid_to IS NULL OR ag.valid_to > NOW())
WHERE g.instance_id = $1
  AND g.id = $2::uuid
GROUP BY g.id
LIMIT 1;
`;

const loadGroups = async (client: QueryClient, instanceId: string): Promise<readonly IamGroupListItem[]> => {
  const result = await client.query<GroupListRow>(GROUP_LIST_QUERY, [instanceId]);
  return result.rows.map(mapGroupListItem);
};

const loadGroupById = async (
  client: QueryClient,
  input: { instanceId: string; groupId: string }
): Promise<IamGroupDetail | undefined> => {
  const result = await client.query<GroupDetailRow>(GROUP_DETAIL_QUERY, [input.instanceId, input.groupId]);
  const row = result.rows[0];
  return row ? mapGroupDetail(row) : undefined;
};

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

export const listGroupsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await prepareGroupRequest(request, ctx, {
    requiredRoles: ADMIN_ROLES,
    rateScope: 'read',
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  try {
    const groups = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadGroups(client, actorResolution.actor.instanceId)
    );
    return jsonResponse(
      200,
      asApiList(groups, { page: 1, pageSize: groups.length, total: groups.length }, actorResolution.actor.requestId)
    );
  } catch {
    return createDatabaseUnavailableError(actorResolution.actor.requestId);
  }
};

export const getGroupInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorResolution = await prepareGroupRequest(request, ctx, {
    requiredRoles: ADMIN_ROLES,
    rateScope: 'read',
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const groupId = readGroupIdOrError(request, actorResolution.actor.requestId);
  if ('error' in groupId) {
    return groupId.error;
  }

  try {
    const group = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadGroupById(client, { instanceId: actorResolution.actor.instanceId, groupId: groupId.groupId })
    );
    if (!group) {
      return createApiError(404, 'not_found', 'Gruppe nicht gefunden.', actorResolution.actor.requestId);
    }
    return jsonResponse(200, asApiItem(group, actorResolution.actor.requestId));
  } catch {
    return createDatabaseUnavailableError(actorResolution.actor.requestId);
  }
};

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
        subjectId: groupId,
        eventType: 'group.created',
        result: 'success',
        payload: {
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

      const group = await loadGroupById(client, { instanceId: actorResolution.actor.instanceId, groupId });
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
        subjectId: groupId.groupId,
        eventType: 'group.updated',
        result: 'success',
        payload: {
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

      return loadGroupById(client, { instanceId: actorResolution.actor.instanceId, groupId: groupId.groupId });
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
        subjectId: groupId.groupId,
        eventType: 'group.deleted',
        result: 'success',
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
