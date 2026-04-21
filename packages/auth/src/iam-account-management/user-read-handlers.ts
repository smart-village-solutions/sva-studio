import type { IamUserDetail } from '@sva/core';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { readString } from '../shared/input-readers.js';

import { asApiItem, asApiList, createApiError, readPage } from './api-helpers.js';
import { listPlatformUsersInternal } from './platform-iam-handlers.js';
import { consumeRateLimit } from './rate-limit.js';
import { resolveTenantKeycloakUsersWithPagination } from './tenant-keycloak-users.js';
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
import {
  applyCanonicalUserDetailProjection,
  applyCanonicalUserListProjection,
  resolveKeycloakRoleNames,
  resolveProjectedMainserverCredentialState,
} from './user-projection.js';
import { resolveUserTimeline } from './user-timeline-query.js';

const createTenantAdminClientNotConfiguredResponse = (actor: {
  readonly instanceId: string;
  readonly requestId?: string;
}): Response =>
  createApiError(
    409,
    'tenant_admin_client_not_configured',
    'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
    actor.requestId,
    {
      dependency: 'keycloak',
      execution_mode: 'tenant_admin',
      instance_id: actor.instanceId,
      reason_code: 'tenant_admin_client_not_configured',
    }
  );

const listTenantUsersWithCanonicalProjection = async (input: {
  readonly instanceId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: UserStatus;
  readonly role?: string;
  readonly search?: string;
  readonly requestId?: string;
  readonly traceId?: string;
}) => {
  const resolved = await withInstanceScopedDb(input.instanceId, (client) =>
    resolveTenantKeycloakUsersWithPagination({ client, ...input })
  );
  const users = await withInstanceScopedDb(input.instanceId, (client) =>
    applyCanonicalUserListProjection({
      client,
      instanceId: input.instanceId,
      users: resolved.users,
      keycloakRoleNamesBySubject: resolved.keycloakRoleNamesBySubject,
    })
  );

  return { users, total: resolved.total };
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
    const resolved = await listTenantUsersWithCanonicalProjection({
      instanceId: access.actor.instanceId,
      page,
      pageSize,
      status,
      role: role ?? undefined,
      search: search ?? undefined,
      requestId: access.actor.requestId,
      traceId: access.actor.traceId,
    });

    return jsonResponse(
      200,
      asApiList(resolved.users, { page, pageSize, total: resolved.total }, access.actor.requestId)
    );
  } catch (error) {
    logger.error('IAM user list failed', {
      operation: 'list_users',
      instance_id: access.actor.instanceId,
      request_id: access.actor.requestId,
      trace_id: access.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error && error.message === 'tenant_admin_client_not_configured') {
      return createTenantAdminClientNotConfiguredResponse(access.actor);
    }
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
