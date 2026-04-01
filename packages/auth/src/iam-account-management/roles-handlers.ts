import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { ADMIN_ROLES } from './constants.js';
import { asApiList, createApiError } from './api-helpers.js';
import { classifyIamDiagnosticError } from './diagnostics.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { loadRoleListItems } from './role-query.js';
import { createRoleInternal } from './roles-handlers.create.js';
import { deleteRoleInternal } from './roles-handlers.delete.js';
import { updateRoleInternal } from './roles-handlers.update.js';
import { requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { withInstanceScopedDb } from './shared-runtime.js';

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

export { createRoleInternal, deleteRoleInternal, updateRoleInternal };
