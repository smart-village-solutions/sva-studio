import { getWorkspaceContext, toJsonErrorResponse, withRequestContext } from '@sva/sdk/server';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { ADMIN_ROLES } from '../iam-account-management/constants.js';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags.js';
import { logger as accountLogger, requireRoles, resolveActorInfo } from '../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { withAuthenticatedUser } from '../middleware.server.js';

export type ResolvedLegalTextsActor = {
  actor: {
    instanceId: string;
    actorAccountId?: string;
    requestId?: string;
    traceId?: string;
  };
};

export const withLegalTextsRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

export const withAuthenticatedLegalTextsHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withLegalTextsRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const requestContext = getWorkspaceContext();
      accountLogger.error('IAM legal texts request failed unexpectedly', {
        operation: 'iam_legal_texts_request',
        endpoint: request.url,
        request_id: requestContext.requestId,
        trace_id: requestContext.traceId,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
      });

      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter IAM-Fehler.', {
        requestId: requestContext.requestId,
      });
    }
  });

export const resolveLegalTextsAdminActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options: { requireActorAccountId?: boolean } = {}
): Promise<ResolvedLegalTextsActor | { error: Response }> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return { error: roleCheck };
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return { error: actorResolution.error };
  }

  if (options.requireActorAccountId && !actorResolution.actor.actorAccountId) {
    return {
      error: createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId),
    };
  }

  return {
    actor: {
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId ?? undefined,
      requestId: actorResolution.actor.requestId,
      traceId: actorResolution.actor.traceId,
    },
  };
};
