import { getWorkspaceContext } from '@sva/server-runtime';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { type AuthenticatedRequestContext } from '../middleware.js';
import { readString } from '../shared/input-readers.js';

const ADMIN_ROLES = new Set(['admin', 'iam_admin', 'support_admin', 'system_admin']);

const isAdminRole = (roles: readonly string[]): boolean => roles.some((role) => ADMIN_ROLES.has(role));

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

export const validateTenantAdminScope = (
  ctx: AuthenticatedRequestContext,
  instanceId: string | undefined
): { ok: true; instanceId: string } | { ok: false; response: Response } => {
  const scoped = validateTenantScope(ctx, instanceId);
  if (!scoped.ok) {
    return scoped;
  }

  if (!isAdminRole(ctx.user.roles)) {
    return {
      ok: false,
      response: createApiError(403, 'forbidden', 'Keine Berechtigung für Tenant-Löschregeln.', getWorkspaceContext().requestId),
    };
  }

  return scoped;
};
