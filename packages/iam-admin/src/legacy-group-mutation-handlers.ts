import type { ApiErrorCode } from '@sva/core';
import type { z } from 'zod';

import { loadLegacyGroupById } from './legacy-group-query.js';
import {
  createLegacyGroupSchema,
  updateLegacyGroupSchema,
  type CreateLegacyGroupInput,
  type UpdateLegacyGroupInput,
} from './legacy-group-schemas.js';
import type { QueryClient } from './query-client.js';
import type { IdempotencyReserveResult } from './types.js';

export type LegacyGroupMutationAuthenticatedRequestContext = {
  readonly sessionId: string;
  readonly user: {
    readonly id: string;
    readonly instanceId?: string;
    readonly roles: string[];
  };
};

export type LegacyGroupMutationActor = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type LegacyGroupMutationPreparedActor = LegacyGroupMutationActor & {
  readonly actorAccountId: string;
};

type ParseRequestBodyResult<TData> =
  | { readonly ok: true; readonly data: TData; readonly rawBody: string }
  | { readonly ok: false };

export type LegacyGroupMutationHandlerDeps<TFeatureFlags = unknown> = {
  readonly asApiItem: (data: unknown, requestId?: string) => unknown;
  readonly completeIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly status: 'COMPLETED' | 'FAILED';
    readonly responseStatus: number;
    readonly responseBody: unknown;
  }) => Promise<void>;
  readonly consumeRateLimit: (input: {
    readonly instanceId: string;
    readonly actorKeycloakSubject: string;
    readonly scope: 'write';
    readonly requestId?: string;
  }) => Response | null;
  readonly createApiError: (
    status: number,
    code: ApiErrorCode,
    message: string,
    requestId?: string,
    details?: Readonly<Record<string, unknown>>
  ) => Response;
  readonly emitActivityLog: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly accountId?: string;
      readonly eventType: 'group.created' | 'group.updated' | 'group.deleted';
      readonly result: 'success';
      readonly payload: Readonly<Record<string, unknown>>;
      readonly requestId?: string;
      readonly traceId?: string;
    }
  ) => Promise<void>;
  readonly ensureFeature: (
    featureFlags: TFeatureFlags,
    feature: 'iam_admin',
    requestId?: string
  ) => Response | null;
  readonly getFeatureFlags: () => TFeatureFlags;
  readonly getWorkspaceContext: () => { readonly requestId?: string };
  readonly iamUserOperationsCounter: {
    readonly add: (value: number, attributes: Readonly<Record<string, string>>) => void;
  };
  readonly isUuid: (value: string) => boolean;
  readonly jsonResponse: (status: number, payload: unknown) => Response;
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly notifyPermissionInvalidation: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly trigger: 'group_created' | 'group_updated' | 'group_deleted' }
  ) => Promise<void>;
  readonly parseRequestBody: <TData>(
    request: Request,
    schema: z.ZodSchema<TData>
  ) => Promise<ParseRequestBodyResult<TData>>;
  readonly readPathSegment: (request: Request, index: number) => string | null | undefined;
  readonly requireIdempotencyKey: (
    request: Request,
    requestId?: string
  ) => { readonly key: string } | { readonly error: Response };
  readonly requireRoles: (
    ctx: LegacyGroupMutationAuthenticatedRequestContext,
    roles: ReadonlySet<string>,
    requestId?: string
  ) => Response | null;
  readonly reserveIdempotency: (input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly endpoint: string;
    readonly idempotencyKey: string;
    readonly payloadHash: string;
  }) => Promise<IdempotencyReserveResult>;
  readonly resolveActorInfo: (
    request: Request,
    ctx: LegacyGroupMutationAuthenticatedRequestContext,
    options: { readonly requireActorMembership: true }
  ) => Promise<{ readonly actor: LegacyGroupMutationActor } | { readonly error: Response }>;
  readonly resolveRolesByIds: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly roleIds: readonly string[] }
  ) => Promise<readonly unknown[]>;
  readonly toPayloadHash: (rawBody: string) => string;
  readonly validateCsrf: (request: Request, requestId?: string) => Response | null;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
};

const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);
const CREATE_GROUP_ENDPOINT = 'POST:/api/v1/iam/groups';

const createDatabaseUnavailableError = (
  deps: Pick<LegacyGroupMutationHandlerDeps, 'createApiError'>,
  requestId?: string
): Response => deps.createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', requestId);

const readGroupIdOrError = (
  deps: Pick<LegacyGroupMutationHandlerDeps, 'createApiError' | 'isUuid' | 'readPathSegment'>,
  request: Request,
  requestId?: string
): { readonly groupId: string } | { readonly error: Response } => {
  const groupId = deps.readPathSegment(request, 4);
  if (!groupId || !deps.isUuid(groupId)) {
    return {
      error: deps.createApiError(400, 'invalid_request', 'Ungültige groupId.', requestId),
    };
  }

  return { groupId };
};

const prepareLegacyGroupMutationRequest = async <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>,
  request: Request,
  ctx: LegacyGroupMutationAuthenticatedRequestContext
): Promise<{ readonly actor: LegacyGroupMutationPreparedActor } | { readonly error: Response }> => {
  const requestContext = deps.getWorkspaceContext();
  const featureCheck = deps.ensureFeature(deps.getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }

  const roleCheck = deps.requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await deps.resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution;
  }

  const rateLimit = deps.consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return { error: rateLimit };
  }

  if (!actorResolution.actor.actorAccountId) {
    return {
      error: deps.createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId),
    };
  }

  return { actor: { ...actorResolution.actor, actorAccountId: actorResolution.actor.actorAccountId } };
};

const replaceLegacyGroupRoles = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly groupId: string; readonly roleIds: readonly string[] }
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

const validateLegacyGroupRoleIds = async <TFeatureFlags>(
  deps: Pick<LegacyGroupMutationHandlerDeps<TFeatureFlags>, 'resolveRolesByIds'>,
  client: QueryClient,
  input: { readonly instanceId: string; readonly roleIds: readonly string[] }
): Promise<boolean> => {
  const uniqueRoleIds = [...new Set(input.roleIds)];
  const roles = await deps.resolveRolesByIds(client, { ...input, roleIds: uniqueRoleIds });
  return roles.length === uniqueRoleIds.length;
};

export const createLegacyGroupMutationHandlers = <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>
) => {
  const createGroupInternal = async (
    request: Request,
    ctx: LegacyGroupMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const actorResolution = await prepareLegacyGroupMutationRequest(deps, request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }
    const { actor } = actorResolution;

    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const idempotencyKey = deps.requireIdempotencyKey(request, actor.requestId);
    if ('error' in idempotencyKey) {
      return idempotencyKey.error;
    }

    const parsed = await deps.parseRequestBody<CreateLegacyGroupInput>(request, createLegacyGroupSchema);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    const reserve = await deps.reserveIdempotency({
      instanceId: actor.instanceId,
      actorAccountId: actor.actorAccountId,
      endpoint: CREATE_GROUP_ENDPOINT,
      idempotencyKey: idempotencyKey.key,
      payloadHash: deps.toPayloadHash(parsed.rawBody),
    });
    if (reserve.status === 'replay') {
      return deps.jsonResponse(reserve.responseStatus, reserve.responseBody);
    }
    if (reserve.status === 'conflict') {
      return deps.createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
    }

    try {
      const responseBody = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const rolesValid = await validateLegacyGroupRoleIds(deps, client, {
          instanceId: actor.instanceId,
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
          [actor.instanceId, parsed.data.groupKey, parsed.data.displayName, parsed.data.description ?? null]
        );
        const groupId = insertResult.rows[0]?.id;
        if (!groupId) {
          throw new Error('database_unavailable:Gruppe konnte nicht angelegt werden.');
        }

        await replaceLegacyGroupRoles(client, {
          instanceId: actor.instanceId,
          groupId,
          roleIds: parsed.data.roleIds,
        });

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'group.created',
          result: 'success',
          payload: {
            groupId,
            roleCount: parsed.data.roleIds.length,
            groupKey: parsed.data.groupKey,
          },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.notifyPermissionInvalidation(client, {
          instanceId: actor.instanceId,
          trigger: 'group_created',
        });

        const group = await loadLegacyGroupById(client, { instanceId: actor.instanceId, groupId });
        if (!group) {
          throw new Error('not_found:Gruppe nicht gefunden.');
        }
        return deps.asApiItem(group, actor.requestId);
      });

      await deps.completeIdempotency({
        instanceId: actor.instanceId,
        actorAccountId: actor.actorAccountId,
        endpoint: CREATE_GROUP_ENDPOINT,
        idempotencyKey: idempotencyKey.key,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody,
      });
      deps.iamUserOperationsCounter.add(1, { action: 'create_group', result: 'success' });
      return deps.jsonResponse(201, responseBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let failureResponse: Response;
      if (message.includes('groups_instance_key_uniq')) {
        failureResponse = deps.createApiError(409, 'conflict', 'Gruppe mit diesem Schlüssel existiert bereits.', actor.requestId);
      } else {
        const [code, detail] = message.split(':', 2);
        failureResponse =
          code === 'invalid_request'
            ? deps.createApiError(400, 'invalid_request', detail, actor.requestId)
            : createDatabaseUnavailableError(deps, actor.requestId);
      }

      await deps.completeIdempotency({
        instanceId: actor.instanceId,
        actorAccountId: actor.actorAccountId,
        endpoint: CREATE_GROUP_ENDPOINT,
        idempotencyKey: idempotencyKey.key,
        status: 'FAILED',
        responseStatus: failureResponse.status,
        responseBody: await failureResponse.clone().json(),
      });
      return failureResponse;
    }
  };

  const updateGroupInternal = async (
    request: Request,
    ctx: LegacyGroupMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const actorResolution = await prepareLegacyGroupMutationRequest(deps, request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }
    const { actor } = actorResolution;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if ('error' in groupId) {
      return groupId.error;
    }

    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await deps.parseRequestBody<UpdateLegacyGroupInput>(request, updateLegacyGroupSchema);
    if (!parsed.ok) {
      return deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    }

    try {
      const group = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        if (parsed.data.roleIds) {
          const rolesValid = await validateLegacyGroupRoleIds(deps, client, {
            instanceId: actor.instanceId,
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
            actor.instanceId,
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
          await replaceLegacyGroupRoles(client, {
            instanceId: actor.instanceId,
            groupId: groupId.groupId,
            roleIds: parsed.data.roleIds,
          });
        }

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'group.updated',
          result: 'success',
          payload: {
            groupId: groupId.groupId,
            roleUpdate: Boolean(parsed.data.roleIds),
            isActive: parsed.data.isActive,
          },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.notifyPermissionInvalidation(client, {
          instanceId: actor.instanceId,
          trigger: 'group_updated',
        });

        return loadLegacyGroupById(client, { instanceId: actor.instanceId, groupId: groupId.groupId });
      });

      if (!group) {
        return deps.createApiError(404, 'not_found', 'Gruppe nicht gefunden.', actor.requestId);
      }
      deps.iamUserOperationsCounter.add(1, { action: 'update_group', result: 'success' });
      return deps.jsonResponse(200, deps.asApiItem(group, actor.requestId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const [code, detail] = message.split(':', 2);
      if (code === 'invalid_request') {
        return deps.createApiError(400, 'invalid_request', detail, actor.requestId);
      }
      deps.logger.error('IAM group update failed', {
        operation: 'update_group',
        instance_id: actor.instanceId,
        group_id: groupId.groupId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        error: message,
      });
      return createDatabaseUnavailableError(deps, actor.requestId);
    }
  };

  const deleteGroupInternal = async (
    request: Request,
    ctx: LegacyGroupMutationAuthenticatedRequestContext
  ): Promise<Response> => {
    const actorResolution = await prepareLegacyGroupMutationRequest(deps, request, ctx);
    if ('error' in actorResolution) {
      return actorResolution.error;
    }
    const { actor } = actorResolution;

    const groupId = readGroupIdOrError(deps, request, actor.requestId);
    if ('error' in groupId) {
      return groupId.error;
    }

    const csrfError = deps.validateCsrf(request, actor.requestId);
    if (csrfError) {
      return csrfError;
    }

    try {
      const updated = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
        const result = await client.query<{ id: string }>(
          `
UPDATE iam.groups
SET is_active = false, updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid
RETURNING id;
`,
          [actor.instanceId, groupId.groupId]
        );
        if (!result.rows[0]?.id) {
          return false;
        }

        await deps.emitActivityLog(client, {
          instanceId: actor.instanceId,
          accountId: actor.actorAccountId,
          eventType: 'group.deleted',
          result: 'success',
          payload: {
            groupId: groupId.groupId,
          },
          requestId: actor.requestId,
          traceId: actor.traceId,
        });

        await deps.notifyPermissionInvalidation(client, {
          instanceId: actor.instanceId,
          trigger: 'group_deleted',
        });

        return true;
      });

      if (!updated) {
        return deps.createApiError(404, 'not_found', 'Gruppe nicht gefunden.', actor.requestId);
      }
      deps.iamUserOperationsCounter.add(1, { action: 'delete_group', result: 'success' });
      return deps.jsonResponse(200, deps.asApiItem({ id: groupId.groupId }, actor.requestId));
    } catch {
      return createDatabaseUnavailableError(deps, actor.requestId);
    }
  };

  return {
    createGroupInternal,
    deleteGroupInternal,
    updateGroupInternal,
  };
};
