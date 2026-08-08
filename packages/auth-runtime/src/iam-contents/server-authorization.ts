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
  resolveCredentialVisibleCompatibilityDecision,
  resolveOrganizationOptionalDecision,
  type ContentPrimitiveAuthorizationResource,
  type ContentPrimitiveAuthorizationResult,
} from './server-authorization.model.js';

export type {
  ContentPrimitiveAuthorizationResource,
  ContentPrimitiveAuthorizationResult,
} from './server-authorization.model.js';

const resolveAuthorizationDecisionResult = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly action: string;
  readonly resource: ContentPrimitiveAuthorizationResource;
  readonly organizationId?: string;
  readonly permissions: readonly EffectivePermission[];
  readonly request: ReturnType<typeof buildAuthorizeRequest>;
  readonly decision: ReturnType<typeof evaluateAuthorizeDecision>;
  readonly credentialVisibleCompatibility: boolean | undefined;
  readonly requestId: string | undefined;
  readonly traceId: string | undefined;
}): ContentPrimitiveAuthorizationResult => {
  if (
    !input.decision.allowed &&
    resolveOrganizationOptionalDecision(
      input.request,
      input.organizationId,
      input.permissions,
      input.action,
      input.resource.contentType
    )
  ) {
    return allowedAuthorizationResult({
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      permissions: input.permissions,
    });
  }

  if (
    !input.decision.allowed &&
    input.credentialVisibleCompatibility === true &&
    resolveCredentialVisibleCompatibilityDecision(input.request, input.permissions)
  ) {
    return allowedAuthorizationResult({
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      permissions: input.permissions,
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    });
  }

  if (!input.decision.allowed) {
    logAuthorizationDenied({
      instanceId: input.instanceId,
      requestId: input.requestId,
      traceId: input.traceId,
      action: input.action,
      resource: input.resource,
      organizationId: input.organizationId,
      reason: input.decision.reason,
    });
    return forbiddenAuthorizationResult();
  }

  return allowedAuthorizationResult({
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    permissions: input.permissions,
    organizationId: input.organizationId,
  });
};

export const authorizeContentPrimitiveForUser = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly action: string;
  readonly resource?: ContentPrimitiveAuthorizationResource;
  readonly permissions?: readonly EffectivePermission[];
  readonly credentialVisibleCompatibility?: boolean;
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
  return resolveAuthorizationDecisionResult({
    instanceId,
    keycloakSubject: input.ctx.user.id,
    action,
    resource,
    ...(organizationId ? { organizationId } : {}),
    permissions,
    request,
    decision,
    credentialVisibleCompatibility: input.credentialVisibleCompatibility,
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
  });
};
