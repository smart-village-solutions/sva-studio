import {
  assignGroupMembershipSchema,
  removeGroupMembershipSchema,
  type AssignGroupMembershipInput,
  type RemoveGroupMembershipInput,
} from './group-schemas.js';
import type { GroupMutationActor, GroupMutationHandlerDeps } from './group-mutation-handlers.js';
import {
  createGroupMutationHandler,
  invalidateMembershipPermissionSnapshot,
  readGroupIdOrError,
  resolveAccountId,
} from './group-mutation-workflow.js';

const persistGroupMembershipAssignment = (
  deps: GroupMutationHandlerDeps,
  actor: GroupMutationActor,
  groupId: string,
  data: AssignGroupMembershipInput
) => {
  return deps.withInstanceScopedDb(actor.instanceId, async (client) => {
    const accountId = await resolveAccountId(client, {
      instanceId: actor.instanceId,
      keycloakSubject: data.keycloakSubject,
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
        data.validFrom ?? null,
        data.validUntil ?? null,
        actor.actorAccountId ?? null,
      ]
    );

    await deps.publishGroupEvent(client, {
      event: 'GroupMembershipChanged',
      instanceId: actor.instanceId,
      groupId,
      accountId,
      keycloakSubject: data.keycloakSubject,
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

    await invalidateMembershipPermissionSnapshot(deps, client, actor, data.keycloakSubject);
  });
};

export const assignGroupMembershipInternal = (deps: GroupMutationHandlerDeps) =>
  createGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      return groupId instanceof Response ? groupId : { groupId };
    },
    parse: async ({ request, actor }) => {
      const body = await deps.parseRequestBody<AssignGroupMembershipInput>(
        request,
        assignGroupMembershipSchema
      );
      return body.ok
        ? body
        : deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    },
    execute: async ({ actor, groupId, input: body }) => {
      try {
        await persistGroupMembershipAssignment(deps, actor, groupId, body.data);

        deps.logger.info('Group membership assigned', {
          operation: 'group_membership_add',
          workspace_id: actor.instanceId,
          group_id: groupId,
          request_id: actor.requestId,
        });
        return deps.jsonResponse(200, deps.asApiItem({ groupId }, actor.requestId));
      } catch (error) {
        if (error instanceof Error && error.message === 'account_not_found') {
          return deps.createApiError(
            404,
            'invalid_request',
            'Benutzer nicht gefunden',
            actor.requestId
          );
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
    },
  });

export const removeGroupMembershipInternal = (deps: GroupMutationHandlerDeps) =>
  createGroupMutationHandler(deps, {
    prepare: ({ request, actor }) => {
      const groupId = readGroupIdOrError(deps, request, actor.requestId);
      return groupId instanceof Response ? groupId : { groupId };
    },
    parse: async ({ request, actor }) => {
      const body = await deps.parseRequestBody<RemoveGroupMembershipInput>(
        request,
        removeGroupMembershipSchema
      );
      return body.ok
        ? body
        : deps.createApiError(400, 'invalid_request', 'Ungültige Eingabe', actor.requestId);
    },
    execute: async ({ actor, groupId, input: body }) => {
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

          await invalidateMembershipPermissionSnapshot(
            deps,
            client,
            actor,
            body.data.keycloakSubject
          );
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
    },
  });
