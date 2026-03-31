import { summarizeContentAccess, type IamContentAccessSummary } from '@sva/core';
import { getWorkspaceContext, toJsonErrorResponse, withRequestContext } from '@sva/sdk/server';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { logger as accountLogger, requireRoles, resolveActorInfo } from '../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { withAuthenticatedUser } from '../middleware.server.js';

const CONTENT_ROLES = new Set(['system_admin', 'app_manager', 'editor']);

export type ResolvedContentActor = {
  actor: {
    instanceId: string;
    keycloakSubject: string;
    actorAccountId?: string;
    actorDisplayName: string;
    requestId?: string;
    traceId?: string;
  };
};

export const resolveContentAccess = async (
  actor: ResolvedContentActor['actor']
): Promise<IamContentAccessSummary> => {
  try {
    const resolved = await resolveEffectivePermissions({
      instanceId: actor.instanceId,
      keycloakSubject: actor.keycloakSubject,
    });

    if (!resolved.ok) {
      accountLogger.error('Content access resolution failed', {
        operation: 'content_access',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        error: resolved.error,
      });

      return {
        state: 'read_only',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        reasonCode: 'context_restricted',
        organizationIds: [],
        sourceKinds: [],
      };
    }

    return summarizeContentAccess(resolved.permissions);
  } catch (error) {
    accountLogger.error('Content access resolution failed', {
      operation: 'content_access',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      state: 'read_only',
      canRead: true,
      canCreate: false,
      canUpdate: false,
      reasonCode: 'context_restricted',
      organizationIds: [],
      sourceKinds: [],
    };
  }
};

export const withContentRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

export const withAuthenticatedContentHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withContentRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const requestContext = getWorkspaceContext();
      accountLogger.error('IAM content request failed unexpectedly', {
        operation: 'iam_content_request',
        endpoint: request.url,
        request_id: requestContext.requestId,
        trace_id: requestContext.traceId,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
      });

      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter Inhaltsfehler.', {
        requestId: requestContext.requestId,
      });
    }
  });

export const resolveContentActor = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options: { requireActorAccountId?: boolean } = {}
): Promise<ResolvedContentActor | { error: Response }> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return { error: featureCheck };
  }

  const roleCheck = requireRoles(ctx, CONTENT_ROLES, requestContext.requestId);
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
      keycloakSubject: ctx.user.id,
      actorAccountId: actorResolution.actor.actorAccountId ?? undefined,
      actorDisplayName: ctx.user.id,
      requestId: actorResolution.actor.requestId,
      traceId: actorResolution.actor.traceId,
    },
  };
};
