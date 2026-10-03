import {
  createGroupSchema,
  updateGroupSchema,
  type CreateGroupInput,
  type UpdateGroupInput,
} from './group-schemas.js';
import { loadGroupMembershipRows } from './group-query.js';
import type { GroupMutationHandlerDeps } from './group-mutation-handlers.js';
import {
  createGroupMutationHandler,
  mapGroupMutationError,
  readErrorMessage,
  readGroupIdOrError,
} from './group-mutation-workflow.js';

export const createGroupInternal = (deps: GroupMutationHandlerDeps) =>
  createGroupMutationHandler(deps, {
    parse: async ({ request, actor }) => {
      const body = await deps.parseRequestBody<CreateGroupInput>(request, createGroupSchema);
      return body.ok
        ? body
        : deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    },
    execute: async ({ actor, input: body }) => {
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
        return deps.createApiError(
          503,
          'database_unavailable',
          'Gruppe konnte nicht angelegt werden.',
          actor.requestId
        );
      }
    },
  });

export const updateGroupInternal = (deps: GroupMutationHandlerDeps) =>
  createGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      return groupId instanceof Response ? groupId : { groupId };
    },
    parse: async ({ request, actor }) => {
      const body = await deps.parseRequestBody<UpdateGroupInput>(request, updateGroupSchema);
      return body.ok
        ? body
        : deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    },
    execute: async ({ actor, groupId, input: body }) => {
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
        return deps.createApiError(
          400,
          'invalid_request',
          'Keine Änderungen angegeben',
          actor.requestId
        );
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
          return deps.createApiError(
            404,
            'invalid_request',
            'Gruppe nicht gefunden',
            actor.requestId
          );
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
        return deps.createApiError(
          503,
          'database_unavailable',
          'Gruppe konnte nicht aktualisiert werden.',
          actor.requestId
        );
      }
    },
  });

export const deleteGroupInternal = (deps: GroupMutationHandlerDeps) =>
  createGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      return groupId instanceof Response ? groupId : { groupId };
    },
    parse: async () => undefined,
    execute: async ({ actor, groupId }) => {
      try {
        const deleted = await deps.withInstanceScopedDb(actor.instanceId, async (client) => {
          const membershipRows = await loadGroupMembershipRows(client, {
            instanceId: actor.instanceId,
            groupId,
          });

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
            payload: {
              group_id: groupId,
              affected_account_ids: membershipRows.rows.map((row) => row.account_id),
            },
            requestId: actor.requestId,
            traceId: actor.traceId,
          });

          return true;
        });

        if (!deleted) {
          return deps.createApiError(
            404,
            'invalid_request',
            'Gruppe nicht gefunden',
            actor.requestId
          );
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
        return deps.createApiError(
          503,
          'database_unavailable',
          'Gruppe konnte nicht gelöscht werden.',
          actor.requestId
        );
      }
    },
  });
