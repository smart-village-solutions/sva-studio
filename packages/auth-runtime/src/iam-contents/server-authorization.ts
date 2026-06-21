import {
  evaluateAuthorizeDecision,
  type AuthorizeRequest,
  type EffectivePermission,
} from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { resolveActorAccountIdWithProvision } from '../iam-account-management/shared-actor-resolution-helpers.js';
import { logger as accountLogger } from '../iam-account-management/shared.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import { getSession } from '../redis-session.js';

export type ContentPrimitiveAuthorizationResource = {
  readonly contentId?: string;
  readonly contentType?: string;
  readonly organizationId?: string;
  readonly createdByAccountId?: string;
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

const ACTION_PATTERN = /^[a-z][a-z0-9-]{1,30}\.[A-Za-z][A-Za-z0-9-]*$/;

const normalizeAuthorizationAction = (action: string): string | null => {
  const normalized = action.trim();
  if (!ACTION_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const buildAuthorizeRequest = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly action: string;
  readonly resource: ContentPrimitiveAuthorizationResource;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): AuthorizeRequest => ({
  instanceId: input.instanceId,
  action: input.action,
    resource: {
      type: input.action.split('.')[0] || 'content',
      ...(input.resource.contentId ? { id: input.resource.contentId } : {}),
      ...(input.resource.organizationId ? { organizationId: input.resource.organizationId } : {}),
      ...((input.resource.contentType || input.resource.createdByAccountId || input.resource.organizationId)
        ? {
            attributes: {
              ...(input.resource.contentType ? { contentType: input.resource.contentType } : {}),
              ...(input.resource.createdByAccountId ? { createdByAccountId: input.resource.createdByAccountId } : {}),
              ...(input.resource.organizationId ? { organizationId: input.resource.organizationId } : {}),
            },
          }
        : {}),
    },
    context: {
      ...(input.resource.organizationId ? { organizationId: input.resource.organizationId } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.traceId ? { traceId: input.traceId } : {}),
      attributes: {
        ...(input.resource.contentType ? { contentType: input.resource.contentType } : {}),
        ...(input.actorAccountId ? { actorAccountId: input.actorAccountId } : {}),
      },
    },
  });

const projectPermissionsForOrganizationOptionalAccess = (
  permissions: readonly EffectivePermission[]
): readonly EffectivePermission[] =>
  permissions.map((permission) => ({
    ...permission,
    organizationId: undefined,
    ...(permission.accessScope === 'organization' ? { accessScope: undefined } : {}),
  }));

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

  const action = normalizeAuthorizationAction(input.action);
  if (!action) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_action',
      message: 'Ungültige Action für diese Inhaltsoperation.',
    };
  }

  const workspaceContext = getWorkspaceContext();
  let organizationId = input.resource?.organizationId;
  const resource = {
    ...input.resource,
  };
  let actorAccountId: string | undefined;

  if (!organizationId) {
    try {
      const session = await getSession(input.ctx.sessionId);
      organizationId = session?.activeOrganizationId;
    } catch (error) {
      accountLogger.error('Content primitive authorization session lookup failed', {
        operation: 'content_primitive_authorize',
        instance_id: instanceId,
        request_id: workspaceContext.requestId,
        trace_id: workspaceContext.traceId,
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

  if (organizationId) {
    resource.organizationId = organizationId;
  }

  if (resource.createdByAccountId) {
    try {
      actorAccountId = await resolveActorAccountIdWithProvision({
        instanceId,
        keycloakSubject: input.ctx.user.id,
        requestId: workspaceContext.requestId,
        traceId: workspaceContext.traceId,
        mayProvisionMissingActorMembership: false,
      });
    } catch (error) {
      accountLogger.error('Content primitive authorization actor resolution failed', {
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
    action,
    resource,
    actorAccountId,
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
  });
  const decision = evaluateAuthorizeDecision(request, permissions);
  if (!decision.allowed && !organizationId && permissions.some((permission) => permission.organizationId)) {
    const organizationOptionalPermissions = projectPermissionsForOrganizationOptionalAccess(permissions);
    const organizationOptionalDecision = evaluateAuthorizeDecision(request, organizationOptionalPermissions);
    if (organizationOptionalDecision.allowed) {
      return {
        ok: true,
        actor: {
          instanceId,
          keycloakSubject: input.ctx.user.id,
        },
        permissions,
      };
    }
  }

  if (!decision.allowed) {
    accountLogger.warn('Content primitive authorization denied', {
      operation: 'content_primitive_authorize',
      instance_id: instanceId,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      action,
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
