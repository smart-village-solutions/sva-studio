import type { ApiErrorCode } from '@sva/core';
import type { z } from 'zod';

import {
  assignGroupMembershipSchema,
  assignGroupRoleSchema,
  createGroupSchema,
  removeGroupMembershipSchema,
  updateGroupSchema,
  type AssignGroupMembershipInput,
  type AssignGroupRoleInput,
  type CreateGroupInput,
  type RemoveGroupMembershipInput,
  type UpdateGroupInput,
} from './group-schemas.js';
import { loadGroupMembershipRows, type GroupQueryClient } from './group-query.js';

export type GroupMutationAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type GroupMutationActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type GroupMutationLogger = {
  readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  readonly info: (message: string, meta: Readonly<Record<string, unknown>>) => void;
};

type ParseRequestBodyResult<TData> =
  | { readonly ok: true; readonly data: TData }
  | { readonly ok: false };

type GroupActivityEventType =
  | 'iam_group_created'
  | 'iam_group_updated'
  | 'iam_group_deleted'
  | 'iam_group_role_assigned'
  | 'iam_group_role_removed'
  | 'iam_group_member_added'
  | 'iam_group_member_removed';

type GroupEvent =
  | {
      readonly event: 'RolePermissionChanged';
      readonly instanceId: string;
      readonly roleId: string;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  | {
      readonly event: 'GroupMembershipChanged';
      readonly instanceId: string;
      readonly groupId: string;
      readonly accountId: string;
      readonly keycloakSubject?: string;
      readonly changeType: 'added' | 'removed';
      readonly requestId?: string;
      readonly traceId?: string;
    }
  | {
      readonly event: 'GroupDeleted';
      readonly instanceId: string;
      readonly groupId: string;
      readonly affectedAccountIds: readonly string[];
      readonly affectedKeycloakSubjects?: readonly string[];
      readonly requestId?: string;
      readonly traceId?: string;
    };

export type GroupMutationHandlerDeps = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly emitActivityLog: (
    client: GroupQueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly eventType: GroupActivityEventType;
      readonly result: 'success';
      readonly payload: Readonly<Record<string, unknown>>;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly getWorkspaceContext: () => { readonly requestId?: string; readonly traceId?: string };
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: GroupMutationLogger;
  readonly parseRequestBody: <TData>(
    request: Request,
    schema: z.ZodSchema<TData>
  ) => Promise<ParseRequestBodyResult<TData>>;
  readonly publishGroupEvent: (client: GroupQueryClient, event: GroupEvent) => Promise<void>;
  readonly randomUUID: () => string;
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly requireRoles: (
    ctx: GroupMutationAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly resolveActorInfo: (
    request: Request,
    ctx: GroupMutationAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: GroupMutationActor } | { readonly error: Response }>;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: GroupQueryClient) => Promise<T>
  ) => Promise<T>;
};

const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);

const resolveGroupMutationActor = async (
  deps: GroupMutationHandlerDeps,
  request: Request,
  ctx: GroupMutationAuthenticatedRequestContext
): Promise<{ readonly actor: GroupMutationActor } | Response> => {
  const requestContext = deps.getWorkspaceContext();

  const roleCheck = deps.requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const csrfError = deps.validateCsrf(request, requestContext.requestId);
  if (csrfError) {
    return csrfError;
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  return { actor: actorResolution.actor };
};

const readGroupIdOrError = (
  deps: GroupMutationHandlerDeps,
  request: Request,
  requestId?: string
): string | Response => {
  const groupId = deps.readPathSegment(request, 4);
  if (!groupId || !deps.isUuid(groupId)) {
    return deps.createApiError(400, 'invalid_request', 'Ungültige Gruppen-ID', requestId);
  }
  return groupId;
};

const resolveAccountId = async (
  client: GroupQueryClient,
  input: { readonly instanceId: string; readonly keycloakSubject: string }
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

const readErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const mapGroupMutationError = (
  deps: GroupMutationHandlerDeps,
  error: unknown,
  requestId?: string
): Response | undefined => {
  const message = readErrorMessage(error);

  if (message.includes('groups_instance_key_uniq')) {
    return deps.createApiError(409, 'conflict', 'Eine Gruppe mit diesem Schlüssel existiert bereits.', requestId);
  }

  if (message.includes('groups_type_chk')) {
    return deps.createApiError(400, 'invalid_request', 'Ungültiger Gruppentyp.', requestId, {
      classification: 'database_or_schema_drift',
      schema_object: 'iam.groups.group_type',
      reason_code: 'groups_type_constraint_violation',
    });
  }

  return undefined;
};

const createGroupInternal = (deps: GroupMutationHandlerDeps) =>
  async (request: Request, ctx: GroupMutationAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await resolveGroupMutationActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { actor } = resolved;

    const body = await deps.parseRequestBody<CreateGroupInput>(request, createGroupSchema);
    if (!body.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    }

    const groupId = deps.randomUUID();
    try {
      await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
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

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'iam_group_created',
          result: 'success',
          payload: { group_id: groupId, group_key: body.data.groupKey },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });
      });

      deps.logger.info('Group created', {
        operation: 'group_create',
        workspace_id: actor.instanceId,
        group_id: groupId,
        group_key: body.data.groupKey,
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });

      return deps.jsonResponse(201, deps.asApiItem({ id: groupId }, actor.requestId));
    } catch (error) {
      const mappedError = mapGroupMutationError(deps, error, actor.requestId);
      if (mappedError) {
        return mappedError;
      }
      deps.logger.error('Group creation failed', {
        operation: 'group_create',
        workspace_id: actor.instanceId,
        error: readErrorMessage(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(503, 'database_unavailable', 'Gruppe konnte nicht angelegt werden.', actor.requestId);
    }
  };

const updateGroupInternal = (deps: GroupMutationHandlerDeps) =>
  async (request: Request, ctx: GroupMutationAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await resolveGroupMutationActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { actor } = resolved;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if (groupId instanceof Response) {
      return groupId;
    }

    const body = await deps.parseRequestBody<UpdateGroupInput>(request, updateGroupSchema);
    if (!body.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
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
      updates.push(`is_active = $${idx}`);
      params.push(body.data.isActive);
    }

    if (updates.length === 1) {
      return deps.createApiError(400, 'invalid_request', 'Keine Änderungen angegeben', actor.requestId);
    }

    try {
      const found = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const updateResult = await client.query(
          `UPDATE iam.groups SET ${updates.join(', ')} WHERE instance_id = $1 AND id = $2::uuid RETURNING id;`,
          params
        );
        if (updateResult.rowCount === 0) {
          return false;
        }

        await deps.emitActivityLog(client, {
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
        return deps.createApiError(404, 'invalid_request', 'Gruppe nicht gefunden', actor.requestId);
      }

      deps.logger.info('Group updated', {
        operation: 'group_update',
        workspace_id: actor.instanceId,
        group_id: groupId,
        request_id: actor.requestId,
      });
      return deps.jsonResponse(200, deps.asApiItem({ id: groupId }, actor.requestId));
    } catch (error) {
      deps.logger.error('Group update failed', {
        operation: 'group_update',
        workspace_id: actor.instanceId,
        group_id: groupId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(503, 'database_unavailable', 'Gruppe konnte nicht aktualisiert werden.', actor.requestId);
    }
  };

const deleteGroupInternal = (deps: GroupMutationHandlerDeps) =>
  async (request: Request, ctx: GroupMutationAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await resolveGroupMutationActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { actor } = resolved;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if (groupId instanceof Response) {
      return groupId;
    }

    try {
      const deleted = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const membershipRows = await loadGroupMembershipRows(client, { instanceId: actor.instanceId, groupId });

        const deleteResult = await client.query(
          `
DELETE FROM iam.groups
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING id;
`,
          [actor.instanceId, groupId]
        );

        if (deleteResult.rowCount === 0) {
          return false;
        }

        await deps.publishGroupEvent(client, {
          event: 'GroupDeleted',
          instanceId: actor.instanceId,
          groupId,
          affectedAccountIds: membershipRows.rows.map((row) => row.account_id),
          affectedKeycloakSubjects: membershipRows.rows
            .map((row) => row.keycloak_subject)
            .filter((value): value is string => typeof value === 'string' && value.length > 0),
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'iam_group_deleted',
          result: 'success',
          payload: { group_id: groupId, affected_account_ids: membershipRows.rows.map((row) => row.account_id) },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        return true;
      });

      if (!deleted) {
        return deps.createApiError(404, 'invalid_request', 'Gruppe nicht gefunden', actor.requestId);
      }

      deps.logger.info('Group deleted', {
        operation: 'group_delete',
        workspace_id: actor.instanceId,
        group_id: groupId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.jsonResponse(200, deps.asApiItem({ id: groupId }, actor.requestId));
    } catch (error) {
      deps.logger.error('Group deletion failed', {
        operation: 'group_delete',
        workspace_id: actor.instanceId,
        group_id: groupId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(503, 'database_unavailable', 'Gruppe konnte nicht gelöscht werden.', actor.requestId);
    }
  };

const assignGroupRoleInternal = (deps: GroupMutationHandlerDeps) =>
  async (request: Request, ctx: GroupMutationAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await resolveGroupMutationActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { actor } = resolved;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if (groupId instanceof Response) {
      return groupId;
    }

    const body = await deps.parseRequestBody<AssignGroupRoleInput>(request, assignGroupRoleSchema);
    if (!body.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    }

    try {
      await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        await client.query(
          `
INSERT INTO iam.group_roles (instance_id, group_id, role_id)
VALUES ($1, $2::uuid, $3::uuid)
ON CONFLICT DO NOTHING;
`,
          [actor.instanceId, groupId, body.data.roleId]
        );

        await deps.publishGroupEvent(client, {
          event: 'RolePermissionChanged',
          instanceId: actor.instanceId,
          roleId: body.data.roleId,
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'iam_group_role_assigned',
          result: 'success',
          payload: { group_id: groupId, role_id: body.data.roleId },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });
      });

      deps.logger.info('Group role assigned', {
        operation: 'group_role_assign',
        workspace_id: actor.instanceId,
        group_id: groupId,
        role_id: body.data.roleId,
        request_id: actor.requestId,
      });
      return deps.jsonResponse(200, deps.asApiItem({ groupId, roleId: body.data.roleId }, actor.requestId));
    } catch (error) {
      deps.logger.error('Group role assignment failed', {
        operation: 'group_role_assign',
        workspace_id: actor.instanceId,
        group_id: groupId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(503, 'database_unavailable', 'Rollenzuweisung fehlgeschlagen.', actor.requestId);
    }
  };

const removeGroupRoleInternal = (deps: GroupMutationHandlerDeps) =>
  async (request: Request, ctx: GroupMutationAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await resolveGroupMutationActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { actor } = resolved;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if (groupId instanceof Response) {
      return groupId;
    }

    const roleId = deps.readPathSegment(request, 6);
    if (!roleId || !deps.isUuid(roleId)) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige Rollen-ID', actor.requestId);
    }

    try {
      await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        await client.query(
          `
DELETE FROM iam.group_roles
WHERE instance_id = $1
  AND group_id = $2::uuid
  AND role_id = $3::uuid;
`,
          [actor.instanceId, groupId, roleId]
        );

        await deps.publishGroupEvent(client, {
          event: 'RolePermissionChanged',
          instanceId: actor.instanceId,
          roleId,
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'iam_group_role_removed',
          result: 'success',
          payload: { group_id: groupId, role_id: roleId },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });
      });

      deps.logger.info('Group role removed', {
        operation: 'group_role_remove',
        workspace_id: actor.instanceId,
        group_id: groupId,
        role_id: roleId,
        request_id: actor.requestId,
      });
      return deps.jsonResponse(200, deps.asApiItem({ groupId, roleId }, actor.requestId));
    } catch (error) {
      deps.logger.error('Group role removal failed', {
        operation: 'group_role_remove',
        workspace_id: actor.instanceId,
        group_id: groupId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(503, 'database_unavailable', 'Rollenentfernung fehlgeschlagen.', actor.requestId);
    }
  };

const assignGroupMembershipInternal = (deps: GroupMutationHandlerDeps) =>
  async (request: Request, ctx: GroupMutationAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await resolveGroupMutationActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { actor } = resolved;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if (groupId instanceof Response) {
      return groupId;
    }

    const body = await deps.parseRequestBody<AssignGroupMembershipInput>(request, assignGroupMembershipSchema);
    if (!body.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    }

    try {
      await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
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

        await deps.publishGroupEvent(client, {
          event: 'GroupMembershipChanged',
          instanceId: actor.instanceId,
          groupId,
          accountId,
          keycloakSubject: body.data.keycloakSubject,
          changeType: 'added',
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'iam_group_member_added',
          result: 'success',
          payload: { group_id: groupId, account_id: accountId },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });
      });

      deps.logger.info('Group membership assigned', {
        operation: 'group_membership_add',
        workspace_id: actor.instanceId,
        group_id: groupId,
        request_id: actor.requestId,
      });
      return deps.jsonResponse(200, deps.asApiItem({ groupId }, actor.requestId));
    } catch (error) {
      if (error instanceof Error && error.message === 'account_not_found') {
        return deps.createApiError(404, 'invalid_request', 'Benutzer nicht gefunden', actor.requestId);
      }
      deps.logger.error('Group membership assignment failed', {
        operation: 'group_membership_add',
        workspace_id: actor.instanceId,
        group_id: groupId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(
        503,
        'database_unavailable',
        'Mitgliedschaft konnte nicht zugewiesen werden.',
        actor.requestId
      );
    }
  };

const removeGroupMembershipInternal = (deps: GroupMutationHandlerDeps) =>
  async (request: Request, ctx: GroupMutationAuthenticatedRequestContext): Promise<Response> => {
    const resolved = await resolveGroupMutationActor(deps, request, ctx);
    if (resolved instanceof Response) {
      return resolved;
    }
    const { actor } = resolved;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if (groupId instanceof Response) {
      return groupId;
    }

    const body = await deps.parseRequestBody<RemoveGroupMembershipInput>(request, removeGroupMembershipSchema);
    if (!body.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    }

    try {
      await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const accountId = await resolveAccountId(client, {
          instanceId: actor.instanceId,
          keycloakSubject: body.data.keycloakSubject,
        });
        if (!accountId) {
          return;
        }

        await client.query(
          `
DELETE FROM iam.account_groups
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND group_id = $3::uuid;
`,
          [actor.instanceId, accountId, groupId]
        );

        await deps.publishGroupEvent(client, {
          event: 'GroupMembershipChanged',
          instanceId: actor.instanceId,
          groupId,
          accountId,
          keycloakSubject: body.data.keycloakSubject,
          changeType: 'removed',
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'iam_group_member_removed',
          result: 'success',
          payload: { group_id: groupId, account_id: accountId },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });
      });

      deps.logger.info('Group membership removed', {
        operation: 'group_membership_remove',
        workspace_id: actor.instanceId,
        group_id: groupId,
        request_id: actor.requestId,
      });
      return deps.jsonResponse(200, deps.asApiItem({ groupId }, actor.requestId));
    } catch (error) {
      deps.logger.error('Group membership removal failed', {
        operation: 'group_membership_remove',
        workspace_id: actor.instanceId,
        group_id: groupId,
        error: error instanceof Error ? error.message : String(error),
        request_id: actor.requestId,
        trace_id: actor.traceId,
      });
      return deps.createApiError(
        503,
        'database_unavailable',
        'Mitgliedschaft konnte nicht entfernt werden.',
        actor.requestId
      );
    }
  };

export const createGroupMutationHandlers = (deps: GroupMutationHandlerDeps) => ({
  assignGroupMembershipInternal: assignGroupMembershipInternal(deps),
  assignGroupRoleInternal: assignGroupRoleInternal(deps),
  createGroupInternal: createGroupInternal(deps),
  deleteGroupInternal: deleteGroupInternal(deps),
  removeGroupMembershipInternal: removeGroupMembershipInternal(deps),
  removeGroupRoleInternal: removeGroupRoleInternal(deps),
  updateGroupInternal: updateGroupInternal(deps),
});
