import type { IamUserDetail, IamUserRoleAssignment } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client';
import {
  getSvaMainserverCredentialAttributeNames,
  readIdentityUserAttributes,
  resolveMainserverCredentialState,
} from '../mainserver-credentials.server';
import type { AuthenticatedRequestContext } from '../middleware.server';
import { jsonResponse } from '../shared/db-helpers';
import { isUuid, readString } from '../shared/input-readers';

import { ADMIN_ROLES } from './constants';
import { asApiItem, asApiList, createApiError, readPage, readPathSegment } from './api-helpers';
import { ensureFeature, getFeatureFlags } from './feature-flags';
import { consumeRateLimit } from './rate-limit';
import { buildRoleSyncFailure } from './role-audit';
import {
  logger,
  requireRoles,
  resolveActorInfo,
  resolveIdentityProvider,
  resolveRolesByExternalNames,
  trackKeycloakCall,
  withInstanceScopedDb,
} from './shared';
import { getRoleDisplayName } from './role-audit';
import type { UserStatus } from './types';
import { USER_STATUS } from './types';
import { resolveUserDetail } from './user-detail-query';
import { resolveUsersWithPagination } from './user-list-query';
import { resolveUserTimeline } from './user-timeline-query';

const mapProjectedRoles = (
  roles: Awaited<ReturnType<typeof resolveRolesByExternalNames>>
): readonly IamUserRoleAssignment[] =>
  roles.map((role) => ({
    roleId: role.id,
    roleKey: role.role_key,
    roleName: getRoleDisplayName(role),
    roleLevel: role.role_level,
  }));

const mergeProjectedRoles = (user: IamUserDetail, roles: readonly IamUserRoleAssignment[]): IamUserDetail => ({
  ...user,
  roles,
});

const mergeMainserverCredentialState = (
  user: IamUserDetail,
  state: ReturnType<typeof resolveMainserverCredentialState>
): IamUserDetail => ({
  ...user,
  mainserverUserApplicationId: state.mainserverUserApplicationId,
  mainserverUserApplicationSecretSet: state.mainserverUserApplicationSecretSet,
});

const resolveKeycloakRoleNames = async (keycloakSubject: string): Promise<readonly string[] | null> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return null;
  }

  return [
    ...new Set(
      await trackKeycloakCall('list_user_roles', () => identityProvider.provider.listUserRoleNames(keycloakSubject))
    ),
  ];
};

const resolveProjectedUserDetail = async (input: {
  client: Parameters<typeof resolveRolesByExternalNames>[0];
  instanceId: string;
  user: IamUserDetail;
  keycloakRoleNames: readonly string[] | null;
}): Promise<IamUserDetail> => {
  if (input.keycloakRoleNames === null) {
    return input.user;
  }
  const mappedRoles = await resolveRolesByExternalNames(input.client, {
    instanceId: input.instanceId,
    externalRoleNames: input.keycloakRoleNames,
  });
  const projectedRoles = mapProjectedRoles(mappedRoles);
  const currentRoleIds = new Set(input.user.roles.map((role) => role.roleId));
  const changed =
    currentRoleIds.size !== projectedRoles.length ||
    projectedRoles.some((role) => !currentRoleIds.has(role.roleId));

  if (!changed) {
    return input.user;
  }

  return mergeProjectedRoles(input.user, projectedRoles);
};

const resolveProjectedMainserverCredentialState = async (keycloakSubject: string) =>
  resolveMainserverCredentialState(
    await readIdentityUserAttributes({
    keycloakSubject,
    attributeNames: getSvaMainserverCredentialAttributeNames(),
    })
  );

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
    logger.error('IAM user list failed', {
      operation: 'list_users',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
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
    if (error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError) {
      return buildRoleSyncFailure({
        error,
        requestId: actorResolution.actor.requestId,
        fallbackMessage: 'Nutzerrollen konnten nicht aus Keycloak geladen werden.',
      });
    }
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
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
