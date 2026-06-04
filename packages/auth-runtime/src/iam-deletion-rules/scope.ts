import { getWorkspaceContext } from '@sva/server-runtime';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { type AuthenticatedRequestContext } from '../middleware.js';
import { readString } from '../shared/input-readers.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';

export const resolveRequestInstanceId = (request: Request, fallback?: string): string | undefined =>
  readString(new URL(request.url).searchParams.get('instanceId')) ?? fallback;

export const validateTenantScope = (
  ctx: AuthenticatedRequestContext,
  instanceId: string | undefined
): { ok: true; instanceId: string } | { ok: false; response: Response } => {
  const requestId = getWorkspaceContext().requestId;

  if (!instanceId) {
    return {
      ok: false,
      response: createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', requestId),
    };
  }

  if (!ctx.user.instanceId) {
    return {
      ok: false,
      response: createApiError(
        403,
        'forbidden',
        'Diese Löschregeln stehen nur für Tenant-Accounts zur Verfügung.',
        requestId
      ),
    };
  }

  if (ctx.user.instanceId !== instanceId) {
    return {
      ok: false,
      response: createApiError(403, 'forbidden', 'Instanzkontext unzulässig.', requestId),
    };
  }

  return { ok: true, instanceId };
};

export const validateTenantAdminScope = async (
  ctx: AuthenticatedRequestContext,
  instanceId: string | undefined,
  action: 'iam.deletionRules.read' | 'iam.deletionRules.write'
): Promise<{ ok: true; instanceId: string } | { ok: false; response: Response }> => {
  const scoped = validateTenantScope(ctx, instanceId);
  if (!scoped.ok) {
    return scoped;
  }

  const authorization = await authorizeInstancePermissionForUser({
    ctx,
    action,
  });
  if (!authorization.ok) {
    return {
      ok: false,
      response: createApiError(
        authorization.status,
        toInstancePermissionApiErrorCode(authorization.error),
        'Keine Berechtigung für Tenant-Löschregeln.',
        getWorkspaceContext().requestId
      ),
    };
  }

  return scoped;
};
