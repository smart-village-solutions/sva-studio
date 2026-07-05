import {
  createDeleteUserHandlerInternal,
  hardDeleteAccount,
  purgeAccountHardDeleteBlockers,
  reconcileOwnedContentForAccountDelete,
} from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';

import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { revokeUserSessions } from '../session-revocation.js';

import { createApiError } from './api-helpers.js';
import { ensureActorCanManageTarget, isSystemAdminAccount, resolveActorMaxRoleLevel } from './shared-actor-authorization.js';
import { emitActivityLog } from './shared-activity.js';
import { iamUserOperationsCounter, logger, trackKeycloakCall } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';
import { resolveUserDetail } from './user-detail-query.js';
import { createUnexpectedMutationErrorResponse, createUserMutationErrorResponse } from './user-mutation-errors.js';
import {
  requireUserMutationIdentityProvider,
  resolveUserMutationTargetActorContext,
} from './user-mutation-request-context.shared.js';

export const resolveDeleteRequestContext = async (request: Request, ctx: AuthenticatedRequestContext) => {
  const requestContext = getWorkspaceContext();
  return resolveUserMutationTargetActorContext(request, ctx, {
    feature: 'iam_admin',
    scope: 'write',
    requiredPermissionAction: 'iam.accounts.delete',
    requestId: requestContext.requestId,
  });
};

const createDeleteMutationErrorResponse = (input: {
  readonly error: unknown;
  readonly requestId?: string;
  readonly forbiddenFallbackMessage: string;
}): Response | null => {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const [code] = message.split(':', 1);

  if (code === 'self_protection') {
    return createApiError(409, 'self_protection', 'Eigener Nutzer kann nicht gelöscht werden.', input.requestId);
  }
  if (code === 'system_admin_delete_protection') {
    return createApiError(
      409,
      'system_admin_delete_protection' as Parameters<typeof createApiError>[1],
      'system_admin muss vor der Löschung entzogen werden.',
      input.requestId
    );
  }

  return createUserMutationErrorResponse(input);
};

const createRequestScopedDeleteUserHandler = (
  resolved: Exclude<Awaited<ReturnType<typeof resolveDeleteRequestContext>>, Response>
) =>
  createDeleteUserHandlerInternal({
    createUnexpectedMutationErrorResponse,
    createUserMutationErrorResponse: createDeleteMutationErrorResponse,
    deleteIdentityUser: async (keycloakSubject) => {
      const identityProvider = await requireUserMutationIdentityProvider(
        resolved.actor.instanceId,
        resolved.actor.requestId
      );
      if (identityProvider instanceof Response) {
        throw new Error('keycloak_unavailable:Tenant-Identity-Provider ist nicht verfügbar.');
      }

      try {
        await identityProvider.provider.deleteUser(keycloakSubject);
      } catch (error) {
        if (error instanceof KeycloakAdminRequestError && error.statusCode === 404) {
          return;
        }
        throw error;
      }
    },
    emitActivityLog,
    ensureActorCanManageTarget,
    hardDeleteUserRecord: hardDeleteAccount,
    iamUserOperationsCounter,
    isSystemAdminAccount,
    logger,
    notFoundResponse: (requestId) => createApiError(404, 'not_found', 'Nutzer nicht gefunden.', requestId),
    purgeAccountHardDeleteBlockers,
    reconcileOwnedContentForAccountDelete,
    resolveActorMaxRoleLevel,
    resolveDeleteRequestContext: async () => ({
      actor: resolved.actor,
      userId: resolved.userId,
    }),
    resolveUserDetail,
    revokeUserSessions,
    trackKeycloakCall,
    withInstanceScopedDb,
  });

export const deleteUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const resolved = await resolveDeleteRequestContext(request, ctx);
  if (resolved instanceof Response) {
    return resolved;
  }

  return createRequestScopedDeleteUserHandler(resolved)(request, ctx);
};
