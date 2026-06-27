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
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
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
const ORGANIZATION_OPTIONAL_ACTIONS = new Set(['categories.read']);
const ORGANIZATION_OPTIONAL_CONTENT_TYPES = new Set([
  'events.event-record',
  'news.article',
  'poi.point-of-interest',
]);

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
    ...(input.resource.contentType ||
    input.resource.ownerUserId ||
    input.resource.ownerOrganizationId ||
    input.resource.organizationId
      ? {
          attributes: {
            ...(input.resource.contentType ? { contentType: input.resource.contentType } : {}),
            ...(input.resource.ownerUserId ? { ownerUserId: input.resource.ownerUserId } : {}),
            ...(input.resource.ownerOrganizationId
              ? { ownerOrganizationId: input.resource.ownerOrganizationId }
              : {}),
            ...(input.resource.organizationId
              ? { organizationId: input.resource.organizationId }
              : {}),
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

const databaseUnavailableAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 503,
  error: 'database_unavailable',
  message: 'Berechtigungen konnten nicht geprüft werden.',
});

const forbiddenAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 403,
  error: 'forbidden',
  message: 'Keine Berechtigung für diese Inhaltsoperation.',
});

const allowedAuthorizationResult = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly permissions: readonly EffectivePermission[];
  readonly organizationId?: string;
}): ContentPrimitiveAuthorizationResult => ({
  ok: true,
  actor: {
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
  },
  permissions: input.permissions,
});

const shouldRetryWithoutOrganizationScope = (
  organizationId: string | undefined,
  permissions: readonly EffectivePermission[],
  action: string,
  contentType: string | undefined
): boolean =>
  !organizationId &&
  permissions.some((permission) => permission.organizationId) &&
  (ORGANIZATION_OPTIONAL_ACTIONS.has(action) ||
    (action.endsWith('.read') && contentType
      ? ORGANIZATION_OPTIONAL_CONTENT_TYPES.has(contentType)
      : false));

const resolveOrganizationOptionalDecision = (
  request: AuthorizeRequest,
  organizationId: string | undefined,
  permissions: readonly EffectivePermission[],
  action: string,
  contentType: string | undefined
): boolean => {
  if (!shouldRetryWithoutOrganizationScope(organizationId, permissions, action, contentType)) {
    return false;
  }

  const organizationOptionalPermissions =
    projectPermissionsForOrganizationOptionalAccess(permissions);
  return evaluateAuthorizeDecision(request, organizationOptionalPermissions).allowed;
};

const resolveActiveOrganizationId = async (input: {
  readonly sessionId: string;
  readonly instanceId: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<string | undefined | ContentPrimitiveAuthorizationResult> => {
  try {
    const session = await getSession(input.sessionId);
    return session?.activeOrganizationId;
  } catch (error) {
    accountLogger.error('Content primitive authorization session lookup failed', {
      operation: 'content_primitive_authorize',
      instance_id: input.instanceId,
      request_id: input.requestId,
      trace_id: input.traceId,
      error: error instanceof Error ? error.message : String(error),
    });

    return databaseUnavailableAuthorizationResult();
  }
};

const resolveActorAccountIdForOwnership = async (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly organizationId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<string | ContentPrimitiveAuthorizationResult> => {
  try {
    const actorAccountId = await resolveActorAccountIdWithProvision({
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      requestId: input.requestId,
      traceId: input.traceId,
      mayProvisionMissingActorMembership: false,
    });
    return actorAccountId ?? forbiddenAuthorizationResult();
  } catch (error) {
    accountLogger.error('Content primitive authorization actor resolution failed', {
      operation: 'content_primitive_authorize',
      instance_id: input.instanceId,
      request_id: input.requestId,
      trace_id: input.traceId,
      organization_id: input.organizationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return databaseUnavailableAuthorizationResult();
  }
};

const resolveAuthorizationPermissions = async (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly organizationId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<readonly EffectivePermission[] | ContentPrimitiveAuthorizationResult> => {
  try {
    const resolved = await resolveEffectivePermissions({
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      organizationId: input.organizationId,
    });

    if (resolved.ok) {
      return resolved.permissions;
    }

    accountLogger.error('Content primitive authorization resolution failed', {
      operation: 'content_primitive_authorize',
      instance_id: input.instanceId,
      request_id: input.requestId,
      trace_id: input.traceId,
      organization_id: input.organizationId,
      error: resolved.error,
    });

    return databaseUnavailableAuthorizationResult();
  } catch (error) {
    accountLogger.error('Content primitive authorization failed', {
      operation: 'content_primitive_authorize',
      instance_id: input.instanceId,
      request_id: input.requestId,
      trace_id: input.traceId,
      organization_id: input.organizationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return databaseUnavailableAuthorizationResult();
  }
};

const logAuthorizationDenied = (input: {
  readonly instanceId: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly action: string;
  readonly resource: ContentPrimitiveAuthorizationResource;
  readonly organizationId?: string;
  readonly reason: string;
}): void => {
  accountLogger.warn('Content primitive authorization denied', {
    operation: 'content_primitive_authorize',
    instance_id: input.instanceId,
    request_id: input.requestId,
    trace_id: input.traceId,
    action: input.action,
    content_id: input.resource.contentId,
    content_type: input.resource.contentType,
    organization_id: input.organizationId,
    reason: input.reason,
  });
};

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

  if (!organizationId) {
    const activeOrganizationId = await resolveActiveOrganizationId({
      sessionId: input.ctx.sessionId,
      instanceId,
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
