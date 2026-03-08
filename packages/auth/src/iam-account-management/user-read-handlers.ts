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
  assignRoles,
  logger,
  notifyPermissionInvalidation,
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
    const user = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const existing = await resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
      if (!existing) {
        return undefined;
      }

      const identityProvider = resolveIdentityProvider();
      if (!identityProvider) {
        return existing;
      }

      const keycloakRoleNames = [
        ...new Set(
          await trackKeycloakCall('list_user_roles', () =>
            identityProvider.provider.listUserRoleNames(existing.keycloakSubject)
          )
        ),
      ];
      const mappedRoles = await resolveRolesByExternalNames(client, {
        instanceId: actorResolution.actor.instanceId,
        externalRoleNames: keycloakRoleNames,
      });
      const currentRoleIds = new Set(existing.roles.map((role) => role.roleId));
      const nextRoleIds = [...new Set(mappedRoles.map((role) => role.id))];
      const changed =
        currentRoleIds.size !== nextRoleIds.length || nextRoleIds.some((roleId) => !currentRoleIds.has(roleId));

      if (!changed) {
        return existing;
      }

      await assignRoles(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: userId,
        roleIds: nextRoleIds,
        assignedBy: actorResolution.actor.actorAccountId,
      });
      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: existing.keycloakSubject,
        trigger: 'user_role_synced_from_keycloak',
      });

      return resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
    });
    if (!user) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }
    return jsonResponse(200, asApiItem(user, actorResolution.actor.requestId));
  } catch (error) {
    if (error instanceof KeycloakAdminRequestError || error instanceof KeycloakAdminUnavailableError) {
      return buildRoleSyncFailure({
        error,
        requestId: actorResolution.actor.requestId,
        fallbackMessage: 'Nutzerrollen konnten nicht aus Keycloak synchronisiert werden.',
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
