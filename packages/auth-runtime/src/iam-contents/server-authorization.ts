import type { EffectivePermission } from '@sva/iam-core';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  allowedAuthorizationResult,
  buildAuthorizeRequest,
  evaluateAuthorizeDecision,
  forbiddenAuthorizationResult,
  invalidActionAuthorizationResult,
  logAuthorizationDenied,
  missingInstanceAuthorizationResult,
  normalizeAuthorizationAction,
  resolveActiveOrganizationId,
  resolveActorAccountIdForOwnership,
  resolveAuthorizationPermissions,
  resolveOrganizationOptionalDecision,
  type ContentPrimitiveAuthorizationResource,
  type ContentPrimitiveAuthorizationResult,
} from './server-authorization.model.js';

export type {
  ContentPrimitiveAuthorizationResource,
  ContentPrimitiveAuthorizationResult,
} from './server-authorization.model.js';

export const authorizeContentPrimitiveForUser = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly action: string;
  readonly resource?: ContentPrimitiveAuthorizationResource;
  readonly permissions?: readonly EffectivePermission[];
}): Promise<ContentPrimitiveAuthorizationResult> => {
  const instanceId = input.ctx.user.instanceId;
  if (!instanceId) {
    return missingInstanceAuthorizationResult();
  }

  const action = normalizeAuthorizationAction(input.action);
  if (!action) {
    return invalidActionAuthorizationResult();
  }

  const workspaceContext = getWorkspaceContext();
  let organizationId = input.resource?.organizationId;
  const resource = {
    ...input.resource,
  };

  if (!organizationId) {
    const activeOrganizationId = await resolveActiveOrganizationId({
      sessionId: input.ctx.sessionId,
      instanceId,
      roleNames: input.ctx.user.roles,
      requestId: workspaceContext.requestId,
      traceId: workspaceContext.traceId,
    });
    if (typeof activeOrganizationId !== 'string' && activeOrganizationId !== undefined) {
      return activeOrganizationId;
    }
    organizationId = activeOrganizationId;
  }

  if (organizationId) {
    resource.organizationId = organizationId;
  }

  let actorAccountId: string | undefined;
  if (resource.ownerUserId || resource.ownerOrganizationId) {
    const resolvedActorAccountId = await resolveActorAccountIdForOwnership({
      instanceId,
      keycloakSubject: input.ctx.user.id,
      organizationId,
      requestId: workspaceContext.requestId,
      traceId: workspaceContext.traceId,
    });
    if (typeof resolvedActorAccountId !== 'string') {
      return resolvedActorAccountId;
    }
    actorAccountId = resolvedActorAccountId;
  }

  const permissions =
    input.permissions ??
    (await resolveAuthorizationPermissions({
      instanceId,
      keycloakSubject: input.ctx.user.id,
      organizationId,
      requestId: workspaceContext.requestId,
      traceId: workspaceContext.traceId,
    }));
  if ('ok' in permissions) {
    return permissions;
  }

  const request = buildAuthorizeRequest({
    instanceId,
    keycloakSubject: input.ctx.user.id,
    action,
    resource,
    actorAccountId,
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
  });
  const decision = evaluateAuthorizeDecision(request, permissions);
  if (
    !decision.allowed &&
    resolveOrganizationOptionalDecision(
      request,
      organizationId,
      permissions,
      action,
      resource.contentType
    )
  ) {
    return allowedAuthorizationResult({
      instanceId,
      keycloakSubject: input.ctx.user.id,
      permissions,
    });
  }

  if (!decision.allowed) {
    logAuthorizationDenied({
      instanceId,
      requestId: workspaceContext.requestId,
      traceId: workspaceContext.traceId,
      action,
      resource,
      organizationId,
      reason: decision.reason,
    });

    return forbiddenAuthorizationResult();
  }

  return allowedAuthorizationResult({
    instanceId,
    keycloakSubject: input.ctx.user.id,
    permissions,
    organizationId,
  });
};
