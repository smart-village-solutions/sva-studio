import {
  evaluateAuthorizeDecision,
  summarizeContentAccess,
  type AuthorizeRequest,
  type IamContentAccessSummary,
  type IamContentDomainCapability,
  type IamContentPrimitiveAction,
} from '@sva/core';
import { getWorkspaceContext, toJsonErrorResponse, withRequestContext } from '@sva/server-runtime';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { logger as accountLogger, requireRoles, resolveActorInfo } from '../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { withAuthenticatedUser } from '../middleware.js';
import { getSession } from '../redis-session.js';

const CONTENT_ROLES = new Set(['system_admin', 'app_manager', 'editor']);

export type ResolvedContentActor = {
  actor: {
    instanceId: string;
    keycloakSubject: string;
    actorAccountId?: string;
    actorDisplayName: string;
    requestId?: string;
    traceId?: string;
    activeOrganizationId?: string;
  };
};

type ContentAuthorizationResource = {
  readonly contentId?: string;
  readonly contentType?: string;
  readonly domainCapability?: IamContentDomainCapability;
  readonly organizationId?: string;
};

const contentPermissionUnavailable = (requestId?: string): Response =>
  createApiError(503, 'database_unavailable', 'Berechtigungen konnten nicht geprüft werden.', requestId);

const buildContentAuthorizeRequest = (
  actor: ResolvedContentActor['actor'],
  action: IamContentPrimitiveAction,
  resource: ContentAuthorizationResource
): AuthorizeRequest => {
  const organizationId = resource.organizationId ?? actor.activeOrganizationId;
  return {
    instanceId: actor.instanceId,
    action,
    resource: {
      type: 'content',
      ...(resource.contentId ? { id: resource.contentId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(resource.contentType ? { attributes: { contentType: resource.contentType } } : {}),
    },
    context: {
      ...(organizationId ? { organizationId } : {}),
      ...(actor.requestId ? { requestId: actor.requestId } : {}),
      ...(actor.traceId ? { traceId: actor.traceId } : {}),
      ...(resource.contentType ? { attributes: { contentType: resource.contentType } } : {}),
    },
  };
};

const logContentAuthorizationDenied = (
  actor: ResolvedContentActor['actor'],
  action: IamContentPrimitiveAction,
  resource: ContentAuthorizationResource,
  reason: string
) => {
  accountLogger.warn('Content authorization denied', {
    operation: 'content_authorize',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    action,
    domain_capability: resource.domainCapability,
    primitive_action: action,
    content_id: resource.contentId,
    content_type: resource.contentType,
    organization_id: resource.organizationId,
    reason,
  });
};

export const authorizeContentAction = async (
  actor: ResolvedContentActor['actor'],
  action: IamContentPrimitiveAction,
  resource: ContentAuthorizationResource = {}
): Promise<Response | null> => {
  const organizationId = resource.organizationId ?? actor.activeOrganizationId;
  try {
    const resolved = await resolveEffectivePermissions({
      instanceId: actor.instanceId,
      keycloakSubject: actor.keycloakSubject,
      organizationId,
    });

    if (!resolved.ok) {
      accountLogger.error('Content authorization resolution failed', {
        operation: 'content_authorize',
        instance_id: actor.instanceId,
        request_id: actor.requestId,
        trace_id: actor.traceId,
        action,
        domain_capability: resource.domainCapability,
        primitive_action: action,
        error: resolved.error,
      });

      return contentPermissionUnavailable(actor.requestId);
    }

    const request = buildContentAuthorizeRequest(actor, action, resource);
    const decision = evaluateAuthorizeDecision(request, resolved.permissions);
    if (decision.allowed) {
      return null;
    }

    logContentAuthorizationDenied(actor, action, resource, decision.reason);
    return createApiError(403, 'forbidden', 'Keine Berechtigung für diese Inhaltsoperation.', actor.requestId, {
      reason_code: 'capability_authorization_denied',
      ...(resource.domainCapability ? { domain_capability: resource.domainCapability } : {}),
      primitive_action: action,
      resource_type: 'content',
      ...(resource.contentId ? { resource_id: resource.contentId } : {}),
    });
  } catch (error) {
    accountLogger.error('Content authorization failed', {
      operation: 'content_authorize',
      instance_id: actor.instanceId,
      request_id: actor.requestId,
      trace_id: actor.traceId,
      action,
      domain_capability: resource.domainCapability,
      primitive_action: action,
      error: error instanceof Error ? error.message : String(error),
    });

    return contentPermissionUnavailable(actor.requestId);
  }
};

export const resolveContentAccess = async (
  actor: ResolvedContentActor['actor']
): Promise<IamContentAccessSummary> => {
  try {
    const resolved = await resolveEffectivePermissions({
      instanceId: actor.instanceId,
      keycloakSubject: actor.keycloakSubject,
      organizationId: actor.activeOrganizationId,
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
        state: 'blocked',
        canRead: false,
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
      state: 'blocked',
      canRead: false,
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

  const session = await getSession(ctx.sessionId);

  return {
    actor: {
      instanceId: actorResolution.actor.instanceId,
      keycloakSubject: ctx.user.id,
      actorAccountId: actorResolution.actor.actorAccountId ?? undefined,
      actorDisplayName: ctx.user.id,
      requestId: actorResolution.actor.requestId,
      traceId: actorResolution.actor.traceId,
      activeOrganizationId: session?.activeOrganizationId,
    },
  };
};
