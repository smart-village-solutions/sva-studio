import type { ApiErrorResponse } from '@sva/core';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { createApiError } from './api-helpers.js';
import { ensureActorCanManageTarget, resolveActorMaxRoleLevel, resolveSystemAdminCount } from './shared-actor-authorization.js';
import { type ActorInfo } from './shared-actor-resolution.js';
import { emitActivityLog, notifyPermissionInvalidation } from './shared-activity.js';
import { iamUserOperationsCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { resolveUsersForBulkDeactivation } from './user-bulk-query.js';
import { hasSystemAdminRole } from './user-update-utils.js';
import {
  completeBulkDeactivateFailure,
  completeBulkDeactivateSuccess,
  resolveBulkDeactivateContext,
} from './user-bulk-deactivate-context.js';

const validateBulkDeactivationTargets = async (input: {
  actor: ActorInfo;
  ctx: AuthenticatedRequestContext;
  actorMaxRoleLevel: number;
  users: Awaited<ReturnType<typeof resolveUsersForBulkDeactivation>>;
  resolveAdminCount: () => Promise<number>;
}) => {
  if (input.users.some((entry) => entry.keycloakSubject === input.ctx.user.id)) {
    throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
  }

  const targetedActiveAdminCount = input.users.filter(
    (user) => user.status === 'active' && hasSystemAdminRole(user.roles)
  ).length;
  if (targetedActiveAdminCount > 0 && (await input.resolveAdminCount()) <= targetedActiveAdminCount) {
    throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
  }

  for (const user of input.users) {
    const targetAccessCheck = ensureActorCanManageTarget({
      actorMaxRoleLevel: input.actorMaxRoleLevel,
      actorRoles: input.ctx.user.roles,
      targetRoles: user.roles,
    });
    if (!targetAccessCheck.ok) {
      throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
    }
  }
};

const deactivateUsersInBulk = async (input: {
  actor: ActorInfo;
  ctx: AuthenticatedRequestContext;
  userIds: readonly string[];
}) =>
  withInstanceScopedDb(input.actor.instanceId, async (client) => {
    const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.ctx.user.id,
      sessionRoleNames: input.ctx.user.roles,
    });
    const users = await resolveUsersForBulkDeactivation(client, {
      instanceId: input.actor.instanceId,
      userIds: input.userIds,
    });

    await validateBulkDeactivationTargets({
      actor: input.actor,
      ctx: input.ctx,
      actorMaxRoleLevel,
      users,
      resolveAdminCount: () => resolveSystemAdminCount(client, input.actor.instanceId),
    });

    await client.query(
      `
UPDATE iam.accounts
SET
  status = 'inactive',
  updated_at = NOW()
WHERE instance_id = $1
  AND id = ANY($2::uuid[]);
`,
      [input.actor.instanceId, input.userIds]
    );

    await emitActivityLog(client, {
      instanceId: input.actor.instanceId,
      accountId: input.actor.actorAccountId,
      eventType: 'user.bulk_deactivated',
      result: 'success',
      payload: {
        total: users.length,
      },
      requestId: input.actor.requestId,
      traceId: input.actor.traceId,
    });

    await Promise.all(
      users.map((user) =>
        notifyPermissionInvalidation(client, {
          instanceId: input.actor.instanceId,
          keycloakSubject: user.keycloakSubject,
          trigger: 'user_bulk_deactivated',
        })
      )
    );

    return users;
  });

export const bulkDeactivateInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const resolved = await resolveBulkDeactivateContext(request, ctx);
  if (resolved instanceof Response) {
    return resolved;
  }

  try {
    const uniqueUserIds = [...new Set(resolved.payload.userIds)];
    const details = await deactivateUsersInBulk({
      actor: resolved.actor,
      ctx,
      userIds: uniqueUserIds,
    });

    await Promise.all(
      details.map((detail) =>
        trackKeycloakCall('deactivate_user_bulk', () =>
          resolved.identityProvider.provider.deactivateUser(detail.keycloakSubject)
        )
      )
    );
    iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'success' });

    return await completeBulkDeactivateSuccess({
      actor: resolved.actor,
      idempotencyKey: resolved.idempotencyKey,
      details,
    });
  } catch (error) {
    logger.error('IAM bulk deactivate failed', {
      workspace_id: resolved.actor.instanceId,
      context: {
        operation: 'bulk_deactivate',
        instance_id: resolved.actor.instanceId,
        request_id: resolved.actor.requestId,
        trace_id: resolved.actor.traceId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'failure' });
    return await completeBulkDeactivateFailure({
      actor: resolved.actor,
      idempotencyKey: resolved.idempotencyKey,
      error,
    });
  }
};
