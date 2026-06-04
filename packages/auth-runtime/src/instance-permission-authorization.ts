import {
  evaluateAuthorizeDecision,
  type AuthorizeRequest,
  type EffectivePermission,
} from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';

import { logger as accountLogger } from './iam-account-management/shared.js';
import { resolveEffectivePermissions } from './iam-authorization/permission-store.js';
import type { AuthenticatedRequestContext } from './middleware.js';

type InstancePermissionAuthorizationErrorCode =
  | 'missing_instance'
  | 'invalid_action'
  | 'database_unavailable'
  | 'forbidden';

export type InstancePermissionAuthorizationResult =
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
      error: InstancePermissionAuthorizationErrorCode;
      message: string;
    }>;

export const toInstancePermissionApiErrorCode = (
  error: InstancePermissionAuthorizationErrorCode
): 'invalid_instance_id' | 'invalid_request' | 'database_unavailable' | 'forbidden' => {
  switch (error) {
    case 'missing_instance':
      return 'invalid_instance_id';
    case 'invalid_action':
      return 'invalid_request';
    case 'database_unavailable':
      return 'database_unavailable';
    case 'forbidden':
      return 'forbidden';
  }
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
  instanceId: string;
  action: string;
  requestId?: string;
  traceId?: string;
}): AuthorizeRequest => ({
  instanceId: input.instanceId,
  action: input.action,
  resource: {
    type: 'instance',
    id: input.instanceId,
  },
  context: {
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.traceId ? { traceId: input.traceId } : {}),
  },
});

export const authorizeInstancePermissionForUser = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly action: string;
  readonly permissions?: readonly EffectivePermission[];
}): Promise<InstancePermissionAuthorizationResult> => {
  const instanceId = input.ctx.user.instanceId;
  if (!instanceId) {
    return {
      ok: false,
      status: 400,
      error: 'missing_instance',
      message: 'Kein Instanzkontext für diese Operation vorhanden.',
    };
  }

  const action = normalizeAuthorizationAction(input.action);
  if (!action) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_action',
      message: 'Ungültige Action für diese Instanzoperation.',
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
        accountLogger.error('Instance permission authorization resolution failed', {
          operation: 'instance_permission_authorize',
          instance_id: instanceId,
          request_id: workspaceContext.requestId,
          trace_id: workspaceContext.traceId,
          action,
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
      accountLogger.error('Instance permission authorization failed', {
        operation: 'instance_permission_authorize',
        instance_id: instanceId,
        request_id: workspaceContext.requestId,
        trace_id: workspaceContext.traceId,
        action,
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
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
  });
  const decision = evaluateAuthorizeDecision(request, permissions);
  if (!decision.allowed) {
    accountLogger.warn('Instance permission authorization denied', {
      operation: 'instance_permission_authorize',
      instance_id: instanceId,
      request_id: workspaceContext.requestId,
      trace_id: workspaceContext.traceId,
      action,
      reason: decision.reason,
    });

    return {
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für diese Instanzoperation.',
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
