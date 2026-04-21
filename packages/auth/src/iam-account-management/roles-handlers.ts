import { getWorkspaceContext } from '@sva/sdk/server';
import type { IamPermission } from '@sva/core';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse, type QueryClient } from '../shared/db-helpers.js';

import { ADMIN_ROLES } from './constants.js';
import { asApiList, createApiError } from './api-helpers.js';
import { classifyIamDiagnosticError } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { listPlatformRoles } from './platform-iam.js';
import { consumeRateLimit } from './rate-limit.js';
import { loadRoleListItems } from './role-query.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { withInstanceScopedDb } from './shared-runtime.js';

const loadPermissions = async (
  client: QueryClient,
  instanceId: string
): Promise<readonly IamPermission[]> => {
  const result = await client.query<{
    id: string;
    instance_id: string;
    permission_key: string;
    description: string | null;
  }>(
    `
SELECT
  p.id,
  p.instance_id,
  p.permission_key,
  p.description
FROM iam.permissions p
WHERE p.instance_id = $1
ORDER BY p.permission_key ASC;
`,
    [instanceId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    instanceId: row.instance_id,
    permissionKey: row.permission_key,
    ...(row.description ? { description: row.description } : {}),
  }));
};

export const listRolesInternal = async (
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
  if (!ctx.user.instanceId) {
    const rateLimit = consumeRateLimit({
      instanceId: 'platform',
      actorKeycloakSubject: ctx.user.id,
      scope: 'read',
      requestId: requestContext.requestId,
    });
    if (rateLimit) {
      return rateLimit;
    }
    try {
      const roles = await listPlatformRoles();
      return jsonResponse(
        200,
        asApiList(roles, { page: 1, pageSize: Math.max(1, roles.length), total: roles.length }, requestContext.requestId)
      );
    } catch {
      return createApiError(
        503,
        'keycloak_unavailable',
        'Plattform-Rollen konnten nicht aus Keycloak geladen werden.',
        requestContext.requestId,
        {
          dependency: 'keycloak',
          reason_code: 'platform_keycloak_unavailable',
          scope_kind: 'platform',
        }
      );
    }
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

  try {
    const roles = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleListItems(client, actorResolution.actor.instanceId)
    );
    return jsonResponse(
      200,
      asApiList(roles, { page: 1, pageSize: roles.length, total: roles.length }, actorResolution.actor.requestId)
    );
  } catch (error) {
    const classified = classifyIamDiagnosticError(
      error,
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
    return createApiError(
      classified.status,
      classified.code,
      classified.message,
      actorResolution.actor.requestId,
      classified.details
    );
  }
};

export const listPermissionsInternal = async (
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

  try {
    const permissions = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadPermissions(client, actorResolution.actor.instanceId)
    );
    return jsonResponse(
      200,
      asApiList(
        permissions,
        { page: 1, pageSize: Math.max(1, permissions.length), total: permissions.length },
        actorResolution.actor.requestId
      )
    );
  } catch (error) {
    const classified = classifyIamDiagnosticError(
      error,
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
    return createApiError(
      classified.status,
      classified.code,
      classified.message,
      actorResolution.actor.requestId,
      classified.details
    );
  }
};

export { createRoleInternal } from './roles-handlers.create.js';
export { deleteRoleInternal } from './roles-handlers.delete.js';
export { updateRoleInternal } from './roles-handlers.update.js';
