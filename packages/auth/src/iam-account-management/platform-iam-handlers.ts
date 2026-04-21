import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { readString } from '../shared/input-readers.js';

import { asApiItem, asApiList, createApiError, readPage } from './api-helpers.js';
import { ADMIN_ROLES } from './constants.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { listPlatformRoles, listPlatformUsers, runPlatformRoleReconcile } from './platform-iam.js';
import { consumeRateLimit } from './rate-limit.js';
import { mapRoleSyncErrorCode, sanitizeRoleErrorMessage } from './role-audit.js';
import { logger, requireRoles } from './shared.js';
import type { UserStatus } from './types.js';
import { USER_STATUS } from './types.js';

const platformKeycloakError = (message: string, requestId?: string): Response =>
  createApiError(503, 'keycloak_unavailable', message, requestId, {
    dependency: 'keycloak',
    reason_code: 'platform_keycloak_unavailable',
    scope_kind: 'platform',
  });

export const listPlatformUsersInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const { page, pageSize } = readPage(request);
  const url = new URL(request.url);
  const status = readString(url.searchParams.get('status')) as UserStatus | undefined;
  const role = readString(url.searchParams.get('role'));
  const search = readString(url.searchParams.get('search'));
  const requestContext = getWorkspaceContext();

  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const rateLimit = consumeRateLimit({
    instanceId: 'platform',
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: requestContext.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }
  if (status && !USER_STATUS.includes(status)) {
    return createApiError(400, 'invalid_request', 'Ungültiger Status-Filter.', requestContext.requestId);
  }

  try {
    const resolved = await listPlatformUsers({
      page,
      pageSize,
      status,
      role: role ?? undefined,
      search: search ?? undefined,
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
    });
    return jsonResponse(
      200,
      asApiList(resolved.users, { page, pageSize, total: resolved.total }, requestContext.requestId)
    );
  } catch (error) {
    logger.error('Platform user list failed', {
      operation: 'list_platform_users',
      scope_kind: 'platform',
      request_id: requestContext.requestId,
      trace_id: requestContext.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return platformKeycloakError(
      'Plattform-Benutzer konnten nicht aus Keycloak geladen werden.',
      requestContext.requestId
    );
  }
};

export const listPlatformRolesInternal = async (
  ctx: AuthenticatedRequestContext,
  requestId?: string
): Promise<Response> => {
  const rateLimit = consumeRateLimit({
    instanceId: 'platform',
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const roles = await listPlatformRoles();
    return jsonResponse(200, asApiList(roles, { page: 1, pageSize: Math.max(1, roles.length), total: roles.length }, requestId));
  } catch {
    return platformKeycloakError('Plattform-Rollen konnten nicht aus Keycloak geladen werden.', requestId);
  }
};

export const reconcilePlatformRolesInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  requestId?: string,
  traceId?: string
): Promise<Response> => {
  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }
  const rateLimit = consumeRateLimit({
    instanceId: 'platform',
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const report = await runPlatformRoleReconcile();
    return jsonResponse(200, asApiItem(report, requestId));
  } catch (error) {
    logger.error('Platform role reconciliation failed', {
      operation: 'reconcile_platform_roles',
      scope_kind: 'platform',
      request_id: requestId,
      trace_id: traceId,
      error: sanitizeRoleErrorMessage(error),
    });
    return createApiError(
      503,
      'keycloak_unavailable',
      'Plattform-Rollen konnten nicht aus Keycloak abgeglichen werden.',
      requestId,
      {
        syncState: 'failed',
        syncError: { code: mapRoleSyncErrorCode(error) },
        scope_kind: 'platform',
      }
    );
  }
};
