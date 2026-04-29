import {
  evaluateAuthorizeDecision,
  type AuthorizeRequest,
  type EffectivePermission,
} from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import { logger as accountLogger } from '../iam-account-management/shared.js';
import { resolveEffectivePermissions } from '../iam-authorization/permission-store.js';
import type { AuthenticatedRequestContext } from '../middleware.js';

export type MediaPrimitiveAuthorizationResource = Readonly<{
  assetId?: string;
  targetType?: string;
  targetId?: string;
  visibility?: string;
}>;

export type MediaPrimitiveAuthorizationResult =
  | Readonly<{
      ok: true;
      actor: Readonly<{
        instanceId: string;
        keycloakSubject: string;
      }>;
      permissions: readonly EffectivePermission[];
    }>
  | Readonly<{
      ok: false;
      status: number;
      error: string;
      message: string;
    }>;

const ACTION_PATTERN = /^[a-z][a-z0-9-]{1,30}\.[A-Za-z][A-Za-z0-9-]*$/;

const normalizeAuthorizationAction = (action: string): string | null => {
  const normalized = action.trim();
  if (!ACTION_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const buildAuthorizeRequest = (input: {
  instanceId: string;
  action: string;
  resource: MediaPrimitiveAuthorizationResource;
  requestId?: string;
  traceId?: string;
}): AuthorizeRequest => ({
  instanceId: input.instanceId,
  action: input.action,
  resource: {
    type: 'media',
    ...(input.resource.assetId ? { id: input.resource.assetId } : {}),
    ...(input.resource.targetId ? { attributes: { targetId: input.resource.targetId } } : {}),
  },
  context: {
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.traceId ? { traceId: input.traceId } : {}),
    attributes: {
      ...(input.resource.targetType ? { targetType: input.resource.targetType } : {}),
      ...(input.resource.targetId ? { targetId: input.resource.targetId } : {}),
      ...(input.resource.visibility ? { visibility: input.resource.visibility } : {}),
    },
  },
});

export const authorizeMediaPrimitiveForUser = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly action: string;
  readonly resource?: MediaPrimitiveAuthorizationResource;
  readonly permissions?: readonly EffectivePermission[];
}): Promise<MediaPrimitiveAuthorizationResult> => {
  const instanceId = input.ctx.user.instanceId;
  if (!instanceId) {
    return {
      ok: false,
      status: 400,
      error: 'missing_instance',
      message: 'Kein Instanzkontext für diese Medienoperation vorhanden.',
    };
  }

  const action = normalizeAuthorizationAction(input.action);
  if (!action) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_action',
      message: 'Ungültige Action für diese Medienoperation.',
    };
  }

  const workspaceContext = getWorkspaceContext();

  let permissions: readonly EffectivePermission[];
  if (input.permissions) {
    permissions = input.permissions;
  } else {
    try {
      const resolved = await resolveEffectivePermissions({
        instanceId,
        keycloakSubject: input.ctx.user.id,
      });

      if (!resolved.ok) {
        accountLogger.error('Media primitive authorization resolution failed', {
          operation: 'media_primitive_authorize',
          instance_id: instanceId,
          request_id: workspaceContext.requestId,
          trace_id: workspaceContext.traceId,
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
      accountLogger.error('Media primitive authorization failed', {
        operation: 'media_primitive_authorize',
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

  const request = buildAuthorizeRequest({
    instanceId,
    action,
    resource: input.resource ?? {},
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
  });
  const decision = evaluateAuthorizeDecision(request, permissions);
  if (!decision.allowed) {
    accountLogger.warn('Media primitive authorization denied', {
      operation: 'media_primitive_authorize',
      instance_id: instanceId,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      action,
      asset_id: input.resource?.assetId,
      target_type: input.resource?.targetType,
      target_id: input.resource?.targetId,
      reason: decision.reason,
    });

    return {
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Medienoperation.',
    };
  }

  return {
    ok: true,
    actor: {
      instanceId,
      keycloakSubject: input.ctx.user.id,
    },
    permissions,
  };
};
