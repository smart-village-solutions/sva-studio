import type { IamUserDetail, IamUserListItem } from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { readString } from '../shared/input-readers.js';

import { asApiItem, asApiList, createApiError, readPage } from './api-helpers.js';
import { listPlatformUsersInternal } from './platform-iam-handlers.js';
import { consumeRateLimit } from './rate-limit.js';
import {
  createDatabaseApiError,
  logUserProjectionDegraded,
  readValidatedUserId,
  resolveUserReadAccess,
} from './user-read-shared.js';
import {
  logger,
  withInstanceScopedDb,
} from './shared.js';
import { USER_STATUS, type UserStatus } from './types.js';
import { resolveUserDetail } from './user-detail-query.js';
import { resolveUsersWithPagination } from './user-list-query.js';
import {
  applyCanonicalUserDetailProjection,
  applyCanonicalUserListProjection,
  isRecoverableUserProjectionError,
  resolveKeycloakRoleNames,
  resolveProjectedMainserverCredentialState,
} from './user-projection.js';
import { resolveUserTimeline } from './user-timeline-query.js';

const USER_LIST_ROLE_PROJECTION_CONCURRENCY = 5;

const resolveListProjectionInputs = async (input: {
  actor: {
    instanceId: string;
    requestId?: string;
    traceId?: string;
  };
  users: readonly IamUserListItem[];
}) =>
  {
    const keycloakRoleNamesBySubject = new Map<string, readonly string[] | null>();
    const workers = Array.from(
      { length: Math.min(USER_LIST_ROLE_PROJECTION_CONCURRENCY, input.users.length) },
      async (_, workerIndex) => {
        for (let index = workerIndex; index < input.users.length; index += USER_LIST_ROLE_PROJECTION_CONCURRENCY) {
          const user = input.users[index];
          if (!user) {
            continue;
          }
          try {
            keycloakRoleNamesBySubject.set(
              user.keycloakSubject,
              await resolveKeycloakRoleNames(input.actor.instanceId, user.keycloakSubject)
            );
          } catch (error) {
            if (!isRecoverableUserProjectionError(error)) {
              throw error;
            }
            logger.warn('IAM user list role projection degraded', {
              operation: 'list_users',
              instance_id: input.actor.instanceId,
              request_id: input.actor.requestId,
              trace_id: input.actor.traceId,
              user_id: user.id,
              error: error.message,
            });
            keycloakRoleNamesBySubject.set(user.keycloakSubject, null);
          }
        }
      }
    );

    await Promise.all(workers);

    return keycloakRoleNamesBySubject;
  };

export const listUsersInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  if (!ctx.user.instanceId) {
    return listPlatformUsersInternal(request, ctx);
  }

  const { page, pageSize } = readPage(request);
  const url = new URL(request.url);
  const status = readString(url.searchParams.get('status')) as UserStatus | undefined;
  const role = readString(url.searchParams.get('role'));
  const search = readString(url.searchParams.get('search'));

  const access = await resolveUserReadAccess(request, ctx);
  if (access.response) {
    return access.response;
  }
  const rateLimit = consumeRateLimit({
    instanceId: access.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: access.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  if (status && !USER_STATUS.includes(status)) {
    return createApiError(400, 'invalid_request', 'Ungültiger Status-Filter.', access.actor.requestId);
  }

  try {
    const resolved = await withInstanceScopedDb(access.actor.instanceId, (client) =>
      resolveUsersWithPagination(client, {
        instanceId: access.actor.instanceId,
        page,
        pageSize,
        status,
        role: role ?? undefined,
        search: search ?? undefined,
      })
    );
    const keycloakRoleNamesBySubject = await resolveListProjectionInputs({
      actor: access.actor,
      users: resolved.users,
    });
    const users = await withInstanceScopedDb(access.actor.instanceId, (client) =>
      applyCanonicalUserListProjection({
        client,
        instanceId: access.actor.instanceId,
        users: resolved.users,
        keycloakRoleNamesBySubject,
      })
    );

    return jsonResponse(
      200,
      asApiList(users, { page, pageSize, total: resolved.total }, access.actor.requestId)
    );
  } catch (error) {
    logger.error('IAM user list failed', {
      operation: 'list_users',
      instance_id: access.actor.instanceId,
      request_id: access.actor.requestId,
      trace_id: access.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createDatabaseApiError(error, access.actor.requestId);
  }
};

export const getUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const access = await resolveUserReadAccess(request, ctx);
  if (access.response) {
    return access.response;
  }
  const userIdResult = readValidatedUserId(request, access.actor.requestId);
  if (userIdResult.response) {
    return userIdResult.response;
  }
  const { userId } = userIdResult;

  const rateLimit = consumeRateLimit({
    instanceId: access.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: access.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const user = await withInstanceScopedDb(access.actor.instanceId, (client) =>
      resolveUserDetail(client, {
        instanceId: access.actor.instanceId,
        userId,
      })
    );
    if (!user) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', access.actor.requestId);
    }

    const [keycloakRoleNamesResult, mainserverCredentialStateResult] = await Promise.allSettled([
      resolveKeycloakRoleNames(access.actor.instanceId, user.keycloakSubject),
      resolveProjectedMainserverCredentialState(user.keycloakSubject, access.actor.instanceId),
    ]);

    logUserProjectionDegraded({
      actor: access.actor,
      userId,
      keycloakRoleNamesResult,
      mainserverCredentialStateResult,
      logger,
    });

    const projectedUser = await withInstanceScopedDb(access.actor.instanceId, (client) =>
      applyCanonicalUserDetailProjection({
        client,
        instanceId: access.actor.instanceId,
        user,
        keycloakRoleNames:
          keycloakRoleNamesResult.status === 'fulfilled' ? keycloakRoleNamesResult.value : null,
        mainserverCredentialState:
          mainserverCredentialStateResult.status === 'fulfilled'
            ? mainserverCredentialStateResult.value
            : { mainserverUserApplicationId: undefined, mainserverUserApplicationSecretSet: false },
      })
    );

    return jsonResponse(200, asApiItem(projectedUser, access.actor.requestId));
  } catch (error) {
    return createDatabaseApiError(error, access.actor.requestId);
  }
};

export const getUserTimelineInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const access = await resolveUserReadAccess(request, ctx);
  if (access.response) {
    return access.response;
  }
  const userIdResult = readValidatedUserId(request, access.actor.requestId);
  if (userIdResult.response) {
    return userIdResult.response;
  }
  const { userId } = userIdResult;

  try {
    const events = await withInstanceScopedDb(access.actor.instanceId, (client) =>
      resolveUserTimeline(client, {
        instanceId: access.actor.instanceId,
        userId,
      })
    );
    return jsonResponse(200, asApiList(events, { page: 1, pageSize: events.length || 1, total: events.length }, access.actor.requestId));
  } catch (error) {
    logger.error('IAM user timeline failed', {
      operation: 'get_user_timeline',
      instance_id: access.actor.instanceId,
      request_id: access.actor.requestId,
      trace_id: access.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Historie ist nicht erreichbar.',
      access.actor.requestId
    );
  }
};
