import {
  evaluateAuthorizeDecision,
  type AuthorizeRequest,
  type EffectivePermission,
} from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { logger as accountLogger } from '../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../middleware.js';

export type ContentPrimitiveAuthorizationResource = {
  readonly contentId?: string;
  readonly contentType?: string;
  readonly organizationId?: string;
};

export type ContentPrimitiveAuthorizationResult =
  | {
      readonly ok: true;
      readonly actor: {
        readonly instanceId: string;
        readonly keycloakSubject: string;
        readonly organizationId?: string;
      };
      readonly permissions: readonly EffectivePermission[];
    }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly message: string;
    };

const buildAuthorizeRequest = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly action: string;
  readonly resource: ContentPrimitiveAuthorizationResource;
  readonly requestId?: string;
  readonly traceId?: string;
}): AuthorizeRequest => ({
  instanceId: input.instanceId,
  action: input.action,
  resource: {
    type: input.action.split('.')[0] ?? 'content',
    ...(input.resource.contentId ? { id: input.resource.contentId } : {}),
    ...(input.resource.organizationId ? { organizationId: input.resource.organizationId } : {}),
    ...(input.resource.contentType ? { attributes: { contentType: input.resource.contentType } } : {}),
  },
  context: {
    ...(input.resource.organizationId ? { organizationId: input.resource.organizationId } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.traceId ? { traceId: input.traceId } : {}),
    ...(input.resource.contentType ? { attributes: { contentType: input.resource.contentType } } : {}),
  },
});

export const authorizeContentPrimitiveForUser = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly action: string;
  readonly resource?: ContentPrimitiveAuthorizationResource;
  readonly permissions?: readonly EffectivePermission[];
}): Promise<ContentPrimitiveAuthorizationResult> => {
  const instanceId = input.ctx.user.instanceId;
  if (!instanceId) {
    return {
      ok: false,
      status: 400,
      error: 'missing_instance',
      message: 'Kein Instanzkontext für diese Inhaltsoperation vorhanden.',
    };
  }

  const workspaceContext = getWorkspaceContext();
  const organizationId = input.resource?.organizationId;
  const resource = {
    ...input.resource,
    ...(organizationId ? { organizationId } : {}),
  };

  let permissions: readonly EffectivePermission[];
  if (input.permissions) {
    permissions = input.permissions;
  } else {
    try {
      const resolved = await resolveEffectivePermissions({
        instanceId,
        keycloakSubject: input.ctx.user.id,
        organizationId,
      });

      if (!resolved.ok) {
        accountLogger.error('Content primitive authorization resolution failed', {
          operation: 'content_primitive_authorize',
          instance_id: instanceId,
          request_id: workspaceContext.requestId,
          trace_id: workspaceContext.traceId,
          organization_id: organizationId,
          error: resolved.error,
        });

        return {
          ok: false,
          status: 503,
          error: 'database_unavailable',
          message: 'Berechtigungen konnten nicht geprüft werden.',
        };
      }

      permissions = resolved.permissions;
    } catch (error) {
      accountLogger.error('Content primitive authorization failed', {
        operation: 'content_primitive_authorize',
        instance_id: instanceId,
        request_id: workspaceContext.requestId,
        trace_id: workspaceContext.traceId,
        organization_id: organizationId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        status: 503,
        error: 'database_unavailable',
        message: 'Berechtigungen konnten nicht geprüft werden.',
      };
    }
  }

  const request = buildAuthorizeRequest({
    instanceId,
    keycloakSubject: input.ctx.user.id,
    action: input.action,
    resource,
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
  });
  const decision = evaluateAuthorizeDecision(request, permissions);
  if (!decision.allowed) {
    accountLogger.warn('Content primitive authorization denied', {
      operation: 'content_primitive_authorize',
      instance_id: instanceId,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      action: input.action,
      content_id: resource.contentId,
      content_type: resource.contentType,
      organization_id: organizationId,
      reason: decision.reason,
    });

    return {
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Inhaltsoperation.',
    };
  }

  return {
    ok: true,
    actor: {
      instanceId,
      keycloakSubject: input.ctx.user.id,
      ...(organizationId ? { organizationId } : {}),
    },
    permissions,
  };
};
