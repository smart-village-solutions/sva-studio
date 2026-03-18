import { getWorkspaceContext, withRequestContext } from '@sva/sdk/server';

import { resolveImpersonationSubject } from '../iam-governance.server';
import { withAuthenticatedUser } from '../middleware.server';
import { jsonResponse } from '../shared/db-helpers';
import {
  buildMePermissionsResponse,
  buildRequestContext,
  errorResponse,
  logger,
  resolveActingAsUserIdFromRequest,
  resolveInstanceIdFromRequest,
  resolveOrganizationIdFromRequest,
} from './shared';
import { resolveEffectivePermissions } from './permission-store';

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
      const effectiveUserId = actingAsUserId && actingAsUserId !== user.id ? actingAsUserId : user.id;
      const isImpersonating = effectiveUserId !== user.id;

      if (isImpersonating) {
        const impersonation = await resolveImpersonationSubject({
          instanceId,
          actorKeycloakSubject: user.id,
          targetKeycloakSubject: effectiveUserId,
        });

        if (!impersonation.ok) {
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
        }
      }

      const resolved = await resolveEffectivePermissions({
        instanceId,
        keycloakSubject: effectiveUserId,
        organizationId: organizationId ?? undefined,
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
