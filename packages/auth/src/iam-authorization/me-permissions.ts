import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';

import { resolveImpersonationSubject } from '../iam-governance.server.js';
import { withAuthenticatedUser } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import {
  buildMePermissionsResponse,
  buildRequestContext,
  errorResponse,
  logger,
  resolveActingAsUserIdFromRequest,
  resolveGeoContextFromRequest,
  resolveInstanceIdFromRequest,
  resolveOrganizationIdFromRequest,
} from './shared.js';
import { resolveEffectivePermissions } from './permission-store.js';

const resolveEffectiveUserId = (actingAsUserId: string | undefined, userId: string): string =>
  actingAsUserId && actingAsUserId !== userId ? actingAsUserId : userId;

const validateImpersonation = async (input: {
  instanceId: string;
  actorUserId: string;
  effectiveUserId: string;
}): Promise<Response | null> => {
  if (input.effectiveUserId === input.actorUserId) {
    return null;
  }

  const impersonation = await resolveImpersonationSubject({
    instanceId: input.instanceId,
    actorKeycloakSubject: input.actorUserId,
    targetKeycloakSubject: input.effectiveUserId,
  });

  if (impersonation.ok) {
    return null;
  }

  if (impersonation.reasonCode === 'DENY_TICKET_REQUIRED') {
    return errorResponse(403, 'impersonation_not_active');
  }
  if (impersonation.reasonCode === 'DENY_IMPERSONATION_DURATION_EXCEEDED') {
    return errorResponse(403, 'impersonation_expired');
  }
  if (impersonation.reasonCode === 'database_unavailable') {
    return errorResponse(503, 'database_unavailable');
  }

  return errorResponse(403, 'instance_scope_mismatch');
};

export const mePermissionsHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = resolveInstanceIdFromRequest(request, user.instanceId);
      if (!instanceId) {
        return errorResponse(400, 'invalid_instance_id');
      }

      if (user.instanceId && user.instanceId !== instanceId) {
        return errorResponse(403, 'instance_scope_mismatch');
      }

      const organizationId = resolveOrganizationIdFromRequest(request);
      if (organizationId === null) {
        return errorResponse(400, 'invalid_organization_id');
      }

      const actingAsUserId = resolveActingAsUserIdFromRequest(request);
      const geoContext = resolveGeoContextFromRequest(request);
      if (geoContext === null) {
        return errorResponse(400, 'invalid_request');
      }

      const effectiveUserId = resolveEffectiveUserId(actingAsUserId, user.id);
      const isImpersonating = effectiveUserId !== user.id;

      const impersonationError = await validateImpersonation({
        instanceId,
        actorUserId: user.id,
        effectiveUserId,
      });
      if (impersonationError) {
        return impersonationError;
      }

      const resolved = await resolveEffectivePermissions({
        instanceId,
        keycloakSubject: effectiveUserId,
        organizationId: organizationId ?? undefined,
        geoUnitId: geoContext.geoUnitId,
        geoHierarchy: geoContext.geoHierarchy,
      });

      if (!resolved.ok) {
        logger.error('Failed to resolve permissions from cache/database', {
          operation: 'me_permissions',
          error: resolved.error,
          ...buildRequestContext(instanceId),
        });

        return errorResponse(503, 'database_unavailable');
      }

      const response = buildMePermissionsResponse({
        instanceId,
        organizationId: organizationId ?? undefined,
        permissions: resolved.permissions,
        actorUserId: user.id,
        effectiveUserId,
        isImpersonating,
        snapshotVersion: resolved.snapshotVersion,
        cacheStatus: resolved.cacheStatus,
      });

      logger.debug('Resolved effective permissions for current user', {
        operation: 'me_permissions',
        permission_count: response.permissions.length,
        ...buildRequestContext(instanceId),
      });

      return jsonResponse(200, {
        ...response,
        requestId: response.requestId ?? getWorkspaceContext().requestId,
        traceId: response.traceId ?? getWorkspaceContext().traceId,
      });
    });
  });
};
