import type { IamUserDetail } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { isUuid, readString } from '../shared/input-readers.js';

import { ADMIN_ROLES } from './constants.js';
import { asApiItem, asApiList, createApiError, readPage, readPathSegment } from './api-helpers.js';
import { classifyIamDiagnosticError } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { buildRoleSyncFailure } from './role-audit.js';
import {
  logger,
  requireRoles,
  resolveActorInfo,
  resolveIdentityProvider,
  resolveRolesByExternalNames,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared.js';
import type { UserStatus } from './types.js';
import { USER_STATUS } from './types.js';
import { resolveUserDetail } from './user-detail-query.js';
import { resolveUsersWithPagination } from './user-list-query.js';
import {
  isRecoverableUserProjectionError,
  mergeMainserverCredentialState,
  resolveKeycloakRoleNames,
  resolveProjectedMainserverCredentialState,
  resolveProjectedUserDetail,
} from './user-projection.js';
import { resolveUserTimeline } from './user-timeline-query.js';

export const listUsersInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }
  const { page, pageSize } = readPage(request);
  const url = new URL(request.url);
  const status = readString(url.searchParams.get('status')) as UserStatus | undefined;
  const role = readString(url.searchParams.get('role'));
  const search = readString(url.searchParams.get('search'));

  if (status && !USER_STATUS.includes(status)) {
    return createApiError(400, 'invalid_request', 'Ungültiger Status-Filter.', actorResolution.actor.requestId);
  }

  try {
    const data = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUsersWithPagination(client, {
        instanceId: actorResolution.actor.instanceId,
        page,
        pageSize,
        status,
        role: role ?? undefined,
        search: search ?? undefined,
      })
    );

    return jsonResponse(
      200,
      asApiList(data.users, { page, pageSize, total: data.total }, actorResolution.actor.requestId)
    );
  } catch (error) {
    const classified = classifyIamDiagnosticError(error, 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
    logger.error('IAM user list failed', {
      operation: 'list_users',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(classified.status, classified.code, classified.message, actorResolution.actor.requestId, classified.details);
  }
};

export const getUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const user = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      })
    );
    if (!user) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }

    const [keycloakRoleNames, mainserverCredentialState] = await Promise.all([
      resolveKeycloakRoleNames(user.keycloakSubject),
      resolveProjectedMainserverCredentialState(user.keycloakSubject),
    ]);
    const projectedUserWithRoles = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveProjectedUserDetail({
        client,
        instanceId: actorResolution.actor.instanceId,
        user,
        keycloakRoleNames,
      })
    );
    const projectedUser = mergeMainserverCredentialState(projectedUserWithRoles, mainserverCredentialState);

    return jsonResponse(200, asApiItem(projectedUser, actorResolution.actor.requestId));
  } catch (error) {
    const classified = classifyIamDiagnosticError(error, 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
    if (isRecoverableUserProjectionError(error)) {
      return buildRoleSyncFailure({
        error,
        requestId: actorResolution.actor.requestId,
        fallbackMessage: 'Nutzerrollen konnten nicht aus Keycloak geladen werden.',
      });
    }
    return createApiError(classified.status, classified.code, classified.message, actorResolution.actor.requestId, classified.details);
  }
};

export const getUserTimelineInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  try {
    const events = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUserTimeline(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      })
    );
    return jsonResponse(200, asApiList(events, { page: 1, pageSize: events.length || 1, total: events.length }, actorResolution.actor.requestId));
  } catch (error) {
    logger.error('IAM user timeline failed', {
      operation: 'get_user_timeline',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Historie ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
  }
};
