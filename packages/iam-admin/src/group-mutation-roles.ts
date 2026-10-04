import { assignGroupRoleSchema, type AssignGroupRoleInput } from './group-schemas.js';
import type { GroupMutationHandlerDeps } from './group-mutation-handlers.js';
import { createGroupMutationHandler, readGroupIdOrError } from './group-mutation-workflow.js';

export const assignGroupRoleInternal = (deps: GroupMutationHandlerDeps) =>
  createGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      return groupId instanceof Response ? groupId : { groupId };
    },
    parse: async ({ request, actor }) => {
      const body = await deps.parseRequestBody<AssignGroupRoleInput>(
        request,
        assignGroupRoleSchema
      );
      return body.ok
        ? body
        : deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    },
    execute: async ({ actor, groupId, input: body }) => {
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
        return deps.jsonResponse(
          200,
          deps.asApiItem({ groupId, roleId: body.data.roleId }, actor.requestId)
        );
      } catch (error) {
        deps.logger.error('Group role assignment failed', {
          operation: 'group_role_assign',
          workspace_id: actor.instanceId,
          group_id: groupId,
          error: error instanceof Error ? error.message : String(error),
          request_id: actor.requestId,
          trace_id: actor.traceId,
        });
        return deps.createApiError(
          503,
          'database_unavailable',
          'Rollenzuweisung fehlgeschlagen.',
          actor.requestId
        );
      }
    },
  });

export const removeGroupRoleInternal = (deps: GroupMutationHandlerDeps) =>
  createGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      if (groupId instanceof Response) {
        return groupId;
      }
      const roleId = deps.readPathSegment(request, 6);
      if (!roleId || !deps.isUuid(roleId)) {
        return deps.createApiError(400, 'invalid_request', 'Ungültige Rollen-ID', actor.requestId);
      }
      return { groupId, roleId };
    },
    parse: async () => undefined,
    execute: async ({ actor, groupId, roleId }) => {
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
        return deps.createApiError(
          503,
          'database_unavailable',
          'Rollenentfernung fehlgeschlagen.',
          actor.requestId
        );
      }
    },
  });
