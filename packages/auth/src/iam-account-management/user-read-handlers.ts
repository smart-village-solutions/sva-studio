import type { IamUserDetail, IamUserRoleAssignment } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client';
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
import type { UserStatus } from './types';
import { USER_STATUS } from './types';
import { resolveUserDetail } from './user-detail-query';
import { resolveUsersWithPagination } from './user-list-query';

const mapProjectedRoles = (
  roles: Awaited<ReturnType<typeof resolveRolesByExternalNames>>
): readonly IamUserRoleAssignment[] =>
  roles.map((role) => ({
    roleId: role.id,
    roleKey: role.role_key,
    roleName: role.role_name,
    displayName: role.display_name ?? role.role_name,
    roleLevel: role.role_level,
    isSystemRole: role.is_system_role,
  }));

const mergeProjectedRoles = (user: IamUserDetail, roles: readonly IamUserRoleAssignment[]): IamUserDetail => ({
  ...user,
  roles,
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

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
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

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
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

    const keycloakRoleNames = await resolveKeycloakRoleNames(user.keycloakSubject);
    const projectedUser = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveProjectedUserDetail({
        client,
        instanceId: actorResolution.actor.instanceId,
        user,
        keycloakRoleNames,
      })
    );

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
