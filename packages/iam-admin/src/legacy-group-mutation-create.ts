import { loadLegacyGroupById } from './legacy-group-query.js';
import { createLegacyGroupSchema, type CreateLegacyGroupInput } from './legacy-group-schemas.js';
import type {
  LegacyGroupMutationHandlerDeps,
  LegacyGroupMutationPreparedActor,
} from './legacy-group-mutation-handlers.js';
import {
  CREATE_GROUP_ENDPOINT,
  createDatabaseUnavailableError,
  createLegacyGroupMutationHandler,
  readErrorMessage,
  replaceLegacyGroupRoles,
  validateLegacyGroupRoleIds,
} from './legacy-group-mutation-workflow.js';

const persistLegacyGroupCreate = async <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>,
  actor: LegacyGroupMutationPreparedActor,
  data: CreateLegacyGroupInput
) => {
  return deps.withInstanceScopedDb(actor.instanceId, async (client) => {
    const rolesValid = await validateLegacyGroupRoleIds(deps, client, {
      instanceId: actor.instanceId,
      roleIds: data.roleIds,
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
      [actor.instanceId, data.groupKey, data.displayName, data.description ?? null]
    );
    const groupId = insertResult.rows[0]?.id;
    if (!groupId) {
      throw new Error('database_unavailable:Gruppe konnte nicht angelegt werden.');
    }

    await replaceLegacyGroupRoles(client, {
      instanceId: actor.instanceId,
      groupId,
      roleIds: data.roleIds,
    });

    await deps.emitActivityLog(client, {
      instanceId: actor.instanceId,
      accountId: actor.actorAccountId,
      eventType: 'group.created',
      result: 'success',
      payload: {
        groupId,
        roleCount: data.roleIds.length,
        groupKey: data.groupKey,
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
};

export const createLegacyGroupInternal = <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>
) =>
  createLegacyGroupMutationHandler(deps, {
    idempotency: async ({ request, actor }) => {
      const idempotencyKey = deps.requireIdempotencyKey(request, actor.requestId);
      if ('error' in idempotencyKey) {
        return idempotencyKey.error;
      }

      const parsed = await deps.parseRequestBody<CreateLegacyGroupInput>(
        request,
        createLegacyGroupSchema
      );
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

      return {
        idempotencyKey: idempotencyKey.key,
        parsed,
      };
    },
    parse: async ({ parsed }) => parsed,
    execute: async ({ actor, idempotencyKey, input: parsed }) => {
      try {
        const responseBody = await persistLegacyGroupCreate(deps, actor, parsed.data);

        await deps.completeIdempotency({
          instanceId: actor.instanceId,
          actorAccountId: actor.actorAccountId,
          endpoint: CREATE_GROUP_ENDPOINT,
          idempotencyKey,
          status: 'COMPLETED',
          responseStatus: 201,
          responseBody,
        });
        deps.iamUserOperationsCounter.add(1, { action: 'create_group', result: 'success' });
        return deps.jsonResponse(201, responseBody);
      } catch (error) {
        const message = readErrorMessage(error);
        let failureResponse: Response;
        if (message.includes('groups_instance_key_uniq')) {
          failureResponse = deps.createApiError(
            409,
            'conflict',
            'Gruppe mit diesem Schlüssel existiert bereits.',
            actor.requestId
          );
        } else {
          const [code, detail] = message.split(':', 2);
          failureResponse =
            code === 'invalid_request'
              ? deps.createApiError(400, 'invalid_request', detail, actor.requestId)
              : createDatabaseUnavailableError(deps, actor.requestId);
        }

        if (failureResponse.status >= 500) {
          deps.logger.error('IAM group create failed', {
            operation: 'create_group',
            instance_id: actor.instanceId,
            request_id: actor.requestId,
            trace_id: actor.traceId,
            error: message,
          });
        }

        await deps.completeIdempotency({
          instanceId: actor.instanceId,
          actorAccountId: actor.actorAccountId,
          endpoint: CREATE_GROUP_ENDPOINT,
          idempotencyKey,
          status: 'FAILED',
          responseStatus: failureResponse.status,
          responseBody: await failureResponse.clone().json(),
        });
        return failureResponse;
      }
    },
  });
