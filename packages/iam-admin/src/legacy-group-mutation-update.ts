import { loadLegacyGroupById } from './legacy-group-query.js';
import { updateLegacyGroupSchema, type UpdateLegacyGroupInput } from './legacy-group-schemas.js';
import type {
  LegacyGroupMutationHandlerDeps,
  LegacyGroupMutationPreparedActor,
} from './legacy-group-mutation-handlers.js';
import {
  createDatabaseUnavailableError,
  createLegacyGroupMutationHandler,
  readErrorMessage,
  readGroupIdOrError,
  replaceLegacyGroupRoles,
  validateLegacyGroupRoleIds,
} from './legacy-group-mutation-workflow.js';

const persistLegacyGroupUpdate = <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>,
  actor: LegacyGroupMutationPreparedActor,
  groupId: string,
  data: UpdateLegacyGroupInput
) => {
  return deps.withInstanceScopedDb(actor.instanceId, async (client) => {
    if (data.roleIds) {
      const rolesValid = await validateLegacyGroupRoleIds(deps, client, {
        instanceId: actor.instanceId,
        roleIds: data.roleIds,
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
        groupId,
        data.displayName ?? null,
        data.description ?? null,
        data.isActive ?? null,
      ]
    );
    if (!updated.rows[0]?.id) {
      return undefined;
    }

    if (data.roleIds) {
      await replaceLegacyGroupRoles(client, {
        instanceId: actor.instanceId,
        groupId,
        roleIds: data.roleIds,
      });
    }

    await deps.emitActivityLog(client, {
      instanceId: actor.instanceId,
      accountId: actor.actorAccountId,
      eventType: 'group.updated',
      result: 'success',
      payload: {
        groupId,
        roleUpdate: Boolean(data.roleIds),
        isActive: data.isActive,
      },
      requestId: actor.requestId,
      traceId: actor.traceId,
    });

    await deps.notifyPermissionInvalidation(client, {
      instanceId: actor.instanceId,
      trigger: 'group_updated',
    });

    return loadLegacyGroupById(client, { instanceId: actor.instanceId, groupId });
  });
};

export const updateLegacyGroupInternal = <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>
) =>
  createLegacyGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      return 'error' in groupId ? groupId.error : { groupId: groupId.groupId };
    },
    parse: async ({ request, actor }) => {
      const parsed = await deps.parseRequestBody<UpdateLegacyGroupInput>(
        request,
        updateLegacyGroupSchema
      );
      return parsed.ok
        ? parsed
        : deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    },
    execute: async ({ actor, groupId, input: parsed }) => {
      try {
        const group = await persistLegacyGroupUpdate(deps, actor, groupId, parsed.data);

        if (!group) {
          return deps.createApiError(404, 'not_found', 'Gruppe nicht gefunden.', actor.requestId);
        }
        deps.iamUserOperationsCounter.add(1, { action: 'update_group', result: 'success' });
        return deps.jsonResponse(200, deps.asApiItem(group, actor.requestId));
      } catch (error) {
        const message = readErrorMessage(error);
        const [code, detail] = message.split(':', 2);
        if (code === 'invalid_request') {
          return deps.createApiError(400, 'invalid_request', detail, actor.requestId);
        }
        deps.logger.error('IAM group update failed', {
          operation: 'update_group',
          instance_id: actor.instanceId,
          group_id: groupId,
          request_id: actor.requestId,
          trace_id: actor.traceId,
          error: message,
        });
        return createDatabaseUnavailableError(deps, actor.requestId);
      }
    },
  });

export const deleteLegacyGroupInternal = <TFeatureFlags>(
  deps: LegacyGroupMutationHandlerDeps<TFeatureFlags>
) =>
  createLegacyGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      return 'error' in groupId ? groupId.error : { groupId: groupId.groupId };
    },
    parse: async () => undefined,
    execute: async ({ actor, groupId }) => {
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
            [actor.instanceId, groupId]
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
              groupId,
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
        return deps.jsonResponse(200, deps.asApiItem({ id: groupId }, actor.requestId));
      } catch (error) {
        deps.logger.error('IAM group delete failed', {
          operation: 'delete_group',
          instance_id: actor.instanceId,
          group_id: groupId,
          request_id: actor.requestId,
          trace_id: actor.traceId,
          error: readErrorMessage(error),
        });
        return createDatabaseUnavailableError(deps, actor.requestId);
      }
    },
  });
