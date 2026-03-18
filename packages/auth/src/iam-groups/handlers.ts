import { randomUUID } from 'node:crypto';

import type { IamGroupDetail } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server';
import type { QueryClient } from '../shared/db-helpers';
import { jsonResponse } from '../shared/db-helpers';
import { isUuid } from '../shared/input-readers';
import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
} from '../iam-account-management/api-helpers';
import { ADMIN_ROLES } from '../iam-account-management/constants';
import { validateCsrf } from '../iam-account-management/csrf';
import {
  emitActivityLog,
  requireRoles,
  resolveActorInfo,
  withInstanceScopedDb,
} from '../iam-account-management/shared';
import { publishGroupEvent } from './events';
import {
  assignGroupMembershipSchema,
  assignGroupRoleSchema,
  createGroupSchema,
  removeGroupMembershipSchema,
  updateGroupSchema,
} from './schemas';
import { mapGroupListItem, type GroupRow } from './types';

const logger = createSdkLogger({ component: 'iam-groups', level: 'info' });

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const GROUP_LIST_SQL = `
SELECT
  g.id,
  g.instance_id,
  g.group_key,
  g.display_name,
  g.description,
  g.group_type,
  g.is_active,
  g.created_at,
  g.updated_at,
  COUNT(DISTINCT ag.account_id)::int AS member_count,
  COUNT(DISTINCT gr.role_id)::int    AS role_count
FROM iam.groups g
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_until IS NULL OR ag.valid_until > now())
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
WHERE g.instance_id = $1
GROUP BY g.id
ORDER BY g.display_name ASC
`;

const GROUP_DETAIL_SQL = `
SELECT
  g.id,
  g.instance_id,
  g.group_key,
  g.display_name,
  g.description,
  g.group_type,
  g.is_active,
  g.created_at,
  g.updated_at,
  COUNT(DISTINCT ag.account_id)::int AS member_count,
  COUNT(DISTINCT gr.role_id)::int    AS role_count
FROM iam.groups g
LEFT JOIN iam.account_groups ag
  ON ag.instance_id = g.instance_id
 AND ag.group_id = g.id
 AND (ag.valid_until IS NULL OR ag.valid_until > now())
LEFT JOIN iam.group_roles gr
  ON gr.instance_id = g.instance_id
 AND gr.group_id = g.id
WHERE g.instance_id = $1
  AND g.id = $2::uuid
GROUP BY g.id
LIMIT 1
`;

const resolveAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const result = await client.query<{ id: string }>(
    `
SELECT a.id
FROM iam.accounts a
JOIN iam.instance_memberships m ON m.account_id = a.id AND m.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return result.rows[0]?.id;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const listGroupsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const { page, pageSize } = readPage(request);

  try {
    const rows = await withInstanceScopedDb(actor.instanceId, async (client) => {
      const result = await client.query<GroupRow>(GROUP_LIST_SQL, [actor.instanceId]);
      return result.rows;
    });

    const paginated = rows.slice((page - 1) * pageSize, page * pageSize);
    return jsonResponse(
      200,
      asApiList(paginated.map(mapGroupListItem), { page, pageSize, total: rows.length }, actor.requestId)
    );
  } catch (error) {
    logger.error('Group list query failed', {
      operation: 'group_list',
      workspace_id: actor.instanceId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Gruppen konnten nicht geladen werden.', actor.requestId);
  }
};

export const getGroupInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const groupId = readPathSegment(request, 4);
  if (!groupId || !isUuid(groupId)) {
    return createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', actor.requestId);
  }

  try {
    const result = await withInstanceScopedDb(actor.instanceId, async (client) => {
      const rows = await client.query<GroupRow>(GROUP_DETAIL_SQL, [actor.instanceId, groupId]);
      if (rows.rowCount === 0) return null;
      const row = rows.rows[0]!;

      const roleRows = await client.query<{ role_id: string }>(
        `SELECT role_id FROM iam.group_roles WHERE instance_id = $1 AND group_id = $2::uuid`,
        [actor.instanceId, groupId]
      );
      const detail: IamGroupDetail = {
        ...mapGroupListItem(row),
        assignedRoleIds: roleRows.rows.map((r) => r.role_id),
      };
      return detail;
    });

    if (!result) {
      return createApiError(404, 'invalid_request', 'Gruppe nicht gefunden', actor.requestId);
    }
    return jsonResponse(200, asApiItem(result, actor.requestId));
  } catch (error) {
    logger.error('Group detail query failed', {
      operation: 'group_detail',
      workspace_id: actor.instanceId,
      group_id: groupId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Gruppe konnte nicht geladen werden.', actor.requestId);
  }
};

export const createGroupInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const csrfError = validateCsrf(request, requestContext.requestId);
  if (csrfError) return csrfError;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const body = await parseRequestBody(request, createGroupSchema);
  if (!body.ok) {
    return createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
  }

  const groupId = randomUUID();
  try {
    await withInstanceScopedDb(actor.instanceId, async (client) => {
      await client.query(
        `
INSERT INTO iam.groups (id, instance_id, group_key, display_name, description, group_type, is_active)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7);
`,
        [
          groupId,
          actor.instanceId,
          body.data.groupKey,
          body.data.displayName,
          body.data.description ?? null,
          body.data.groupType,
          body.data.isActive,
        ]
      );

      await emitActivityLog(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
        eventType: 'iam_group_created',
        result: 'success',
        payload: { group_id: groupId, group_key: body.data.groupKey },
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
    });

    logger.info('Group created', {
      operation: 'group_create',
      workspace_id: actor.instanceId,
      group_id: groupId,
      group_key: body.data.groupKey,
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });

    return jsonResponse(201, asApiItem({ id: groupId }, actor.requestId));
  } catch (error) {
    if (error instanceof Error && error.message.includes('groups_instance_key_uniq')) {
      return createApiError(409, 'invalid_request', 'Eine Gruppe mit diesem Schlüssel existiert bereits.', actor.requestId);
    }
    logger.error('Group creation failed', {
      operation: 'group_create',
      workspace_id: actor.instanceId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Gruppe konnte nicht angelegt werden.', actor.requestId);
  }
};

export const updateGroupInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const csrfError = validateCsrf(request, requestContext.requestId);
  if (csrfError) return csrfError;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const groupId = readPathSegment(request, 4);
  if (!groupId || !isUuid(groupId)) {
    return createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', actor.requestId);
  }

  const body = await parseRequestBody(request, updateGroupSchema);
  if (!body.ok) {
    return createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
  }

  const updates: string[] = ['updated_at = now()'];
  const params: unknown[] = [actor.instanceId, groupId];
  let idx = 3;

  if (body.data.displayName !== undefined) {
    updates.push(`display_name = $${idx++}`);
    params.push(body.data.displayName);
  }
  if ('description' in body.data) {
    updates.push(`description = $${idx++}`);
    params.push(body.data.description ?? null);
  }
  if (body.data.isActive !== undefined) {
    updates.push(`is_active = $${idx++}`);
    params.push(body.data.isActive);
  }

  if (updates.length === 1) {
    return createApiError(400, 'invalid_request', 'Keine Änderungen angegeben', actor.requestId);
  }

  try {
    const found = await withInstanceScopedDb(actor.instanceId, async (client) => {
      const updateResult = await client.query(
        `UPDATE iam.groups SET ${updates.join(', ')} WHERE instance_id = $1 AND id = $2::uuid RETURNING id;`,
        params
      );
      if (updateResult.rowCount === 0) return false;

      await emitActivityLog(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
        eventType: 'iam_group_updated',
        result: 'success',
        payload: { group_id: groupId, changes: body.data },
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
      return true;
    });

    if (!found) {
      return createApiError(404, 'invalid_request', 'Gruppe nicht gefunden', actor.requestId);
    }

    logger.info('Group updated', {
      operation: 'group_update',
      workspace_id: actor.instanceId,
      group_id: groupId,
      request_id: actor.requestId,
    });
    return jsonResponse(200, asApiItem({ id: groupId }, actor.requestId));
  } catch (error) {
    logger.error('Group update failed', {
      operation: 'group_update',
      workspace_id: actor.instanceId,
      group_id: groupId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Gruppe konnte nicht aktualisiert werden.', actor.requestId);
  }
};

export const assignGroupRoleInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const csrfError = validateCsrf(request, requestContext.requestId);
  if (csrfError) return csrfError;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const groupId = readPathSegment(request, 4);
  if (!groupId || !isUuid(groupId)) {
    return createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', actor.requestId);
  }

  const body = await parseRequestBody(request, assignGroupRoleSchema);
  if (!body.ok) {
    return createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
  }

  try {
    await withInstanceScopedDb(actor.instanceId, async (client) => {
      await client.query(
        `
INSERT INTO iam.group_roles (instance_id, group_id, role_id)
VALUES ($1, $2::uuid, $3::uuid)
ON CONFLICT DO NOTHING;
`,
        [actor.instanceId, groupId, body.data.roleId]
      );

      await publishGroupEvent(client, {
        event: 'RolePermissionChanged',
        instanceId: actor.instanceId,
        roleId: body.data.roleId,
        requestId: actor.requestId,
        traceId: actor.traceId,
      });

      await emitActivityLog(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
        eventType: 'iam_group_role_assigned',
        result: 'success',
        payload: { group_id: groupId, role_id: body.data.roleId },
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
    });

    logger.info('Group role assigned', {
      operation: 'group_role_assign',
      workspace_id: actor.instanceId,
      group_id: groupId,
      role_id: body.data.roleId,
      request_id: actor.requestId,
    });
    return jsonResponse(200, asApiItem({ groupId, roleId: body.data.roleId }, actor.requestId));
  } catch (error) {
    logger.error('Group role assignment failed', {
      operation: 'group_role_assign',
      workspace_id: actor.instanceId,
      group_id: groupId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Rollenzuweisung fehlgeschlagen.', actor.requestId);
  }
};

export const removeGroupRoleInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const csrfError = validateCsrf(request, requestContext.requestId);
  if (csrfError) return csrfError;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const groupId = readPathSegment(request, 4);
  if (!groupId || !isUuid(groupId)) {
    return createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', actor.requestId);
  }

  const roleId = readPathSegment(request, 6);
  if (!roleId || !isUuid(roleId)) {
    return createApiError(400, 'invalid_request', 'Ungültige Rollen-ID', actor.requestId);
  }

  try {
    await withInstanceScopedDb(actor.instanceId, async (client) => {
      await client.query(
        `
DELETE FROM iam.group_roles
WHERE instance_id = $1
  AND group_id = $2::uuid
  AND role_id = $3::uuid;
`,
        [actor.instanceId, groupId, roleId]
      );

      await publishGroupEvent(client, {
        event: 'RolePermissionChanged',
        instanceId: actor.instanceId,
        roleId,
        requestId: actor.requestId,
        traceId: actor.traceId,
      });

      await emitActivityLog(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
        eventType: 'iam_group_role_removed',
        result: 'success',
        payload: { group_id: groupId, role_id: roleId },
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
    });

    logger.info('Group role removed', {
      operation: 'group_role_remove',
      workspace_id: actor.instanceId,
      group_id: groupId,
      role_id: roleId,
      request_id: actor.requestId,
    });
    return jsonResponse(200, asApiItem({ groupId, roleId }, actor.requestId));
  } catch (error) {
    logger.error('Group role removal failed', {
      operation: 'group_role_remove',
      workspace_id: actor.instanceId,
      group_id: groupId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Rollenentfernung fehlgeschlagen.', actor.requestId);
  }
};

export const assignGroupMembershipInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const csrfError = validateCsrf(request, requestContext.requestId);
  if (csrfError) return csrfError;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const groupId = readPathSegment(request, 4);
  if (!groupId || !isUuid(groupId)) {
    return createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', actor.requestId);
  }

  const body = await parseRequestBody(request, assignGroupMembershipSchema);
  if (!body.ok) {
    return createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
  }

  try {
    await withInstanceScopedDb(actor.instanceId, async (client) => {
      const accountId = await resolveAccountId(client, {
        instanceId: actor.instanceId,
        keycloakSubject: body.data.keycloakSubject,
      });
      if (!accountId) {
        throw new Error('account_not_found');
      }

      await client.query(
        `
INSERT INTO iam.account_groups (instance_id, account_id, group_id, valid_from, valid_until, assigned_by)
VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6::uuid)
ON CONFLICT (instance_id, account_id, group_id) DO UPDATE
  SET valid_from = EXCLUDED.valid_from,
      valid_until = EXCLUDED.valid_until,
      assigned_at = now(),
      assigned_by = EXCLUDED.assigned_by;
`,
        [
          actor.instanceId,
          accountId,
          groupId,
          body.data.validFrom ?? null,
          body.data.validUntil ?? null,
          actor.actorAccountId ?? null,
        ]
      );

      await publishGroupEvent(client, {
        event: 'GroupMembershipChanged',
        instanceId: actor.instanceId,
        groupId,
        accountId,
        changeType: 'added',
        requestId: actor.requestId,
        traceId: actor.traceId,
      });

      await emitActivityLog(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
        eventType: 'iam_group_member_added',
        result: 'success',
        payload: { group_id: groupId, account_id: accountId },
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
    });

    logger.info('Group membership assigned', {
      operation: 'group_membership_add',
      workspace_id: actor.instanceId,
      group_id: groupId,
      request_id: actor.requestId,
    });
    return jsonResponse(200, asApiItem({ groupId }, actor.requestId));
  } catch (error) {
    if (error instanceof Error && error.message === 'account_not_found') {
      return createApiError(404, 'invalid_request', 'Benutzer nicht gefunden', actor.requestId);
    }
    logger.error('Group membership assignment failed', {
      operation: 'group_membership_add',
      workspace_id: actor.instanceId,
      group_id: groupId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Mitgliedschaft konnte nicht zugewiesen werden.', actor.requestId);
  }
};

export const removeGroupMembershipInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) return roleCheck;

  const csrfError = validateCsrf(request, requestContext.requestId);
  if (csrfError) return csrfError;

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) return actorResolution.error;
  const { actor } = actorResolution;

  const groupId = readPathSegment(request, 4);
  if (!groupId || !isUuid(groupId)) {
    return createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', actor.requestId);
  }

  const body = await parseRequestBody(request, removeGroupMembershipSchema);
  if (!body.ok) {
    return createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
  }

  try {
    await withInstanceScopedDb(actor.instanceId, async (client) => {
      const accountId = await resolveAccountId(client, {
        instanceId: actor.instanceId,
        keycloakSubject: body.data.keycloakSubject,
      });
      if (!accountId) return;

      await client.query(
        `
DELETE FROM iam.account_groups
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND group_id = $3::uuid;
`,
        [actor.instanceId, accountId, groupId]
      );

      await publishGroupEvent(client, {
        event: 'GroupMembershipChanged',
        instanceId: actor.instanceId,
        groupId,
        accountId,
        changeType: 'removed',
        requestId: actor.requestId,
        traceId: actor.traceId,
      });

      await emitActivityLog(client, {
        instanceId: actor.instanceId,
        accountId: actor.actorAccountId,
        eventType: 'iam_group_member_removed',
        result: 'success',
        payload: { group_id: groupId, account_id: accountId },
        requestId: actor.requestId,
        traceId: actor.traceId,
      });
    });

    logger.info('Group membership removed', {
      operation: 'group_membership_remove',
      workspace_id: actor.instanceId,
      group_id: groupId,
      request_id: actor.requestId,
    });
    return jsonResponse(200, asApiItem({ groupId }, actor.requestId));
  } catch (error) {
    logger.error('Group membership removal failed', {
      operation: 'group_membership_remove',
      workspace_id: actor.instanceId,
      group_id: groupId,
      error: error instanceof Error ? error.message : String(error),
      request_id: actor.requestId,
      trace_id: actor.traceId,
    });
    return createApiError(503, 'database_unavailable', 'Mitgliedschaft konnte nicht entfernt werden.', actor.requestId);
  }
};
