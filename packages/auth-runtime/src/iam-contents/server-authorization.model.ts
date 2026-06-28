import {
  evaluateAuthorizeDecision,
  type AuthorizeRequest,
  type EffectivePermission,
} from '@sva/iam-core';

import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import { resolveActorAccountIdWithProvision } from '../iam-account-management/shared-actor-resolution-helpers.js';
import { logger as accountLogger } from '../iam-account-management/shared.js';
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

export const normalizeAuthorizationAction = (action: string): string | null => {
  const normalized = action.trim();
  if (!ACTION_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

export const buildAuthorizeRequest = (input: {
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

export const databaseUnavailableAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 503,
  error: 'database_unavailable',
  message: 'Berechtigungen konnten nicht geprüft werden.',
});

export const forbiddenAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 403,
  error: 'forbidden',
  message: 'Keine Berechtigung für diese Inhaltsoperation.',
});

export const missingInstanceAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 400,
  error: 'missing_instance',
  message: 'Kein Instanzkontext für diese Inhaltsoperation vorhanden.',
});

export const invalidActionAuthorizationResult = (): ContentPrimitiveAuthorizationResult => ({
  ok: false,
  status: 400,
  error: 'invalid_action',
  message: 'Ungültige Action für diese Inhaltsoperation.',
});

export const allowedAuthorizationResult = (input: {
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

export const resolveOrganizationOptionalDecision = (
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

export const resolveActiveOrganizationId = async (input: {
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

export const resolveActorAccountIdForOwnership = async (input: {
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

export const resolveAuthorizationPermissions = async (input: {
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

export const logAuthorizationDenied = (input: {
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

export { evaluateAuthorizeDecision };
