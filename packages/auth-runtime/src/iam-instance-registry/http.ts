import { createApiError } from '../iam-account-management/api-helpers.js';
import { requireRoles } from '../iam-account-management/shared-actor-resolution.js';
import { getWorkspaceContext, isCanonicalAuthHost } from '@sva/server-runtime';
import { createInstanceRegistryHttpGuards } from '@sva/instance-registry/http-guards';

import { isRegistryServiceContext, type RegistryRequestContext } from './auth-context.js';
import { resolveEffectiveRequestHost } from '../request-hosts.js';
const isRootHostRequest = (request: Request): boolean => isCanonicalAuthHost(resolveEffectiveRequestHost(request));

const httpGuards = createInstanceRegistryHttpGuards<RegistryRequestContext>({
  getRequestId: () => getWorkspaceContext().requestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  isRootHostRequest,
  requireRoles: (ctx, roles, requestId) =>
    isRegistryServiceContext(ctx)
      ? [...roles].every((role) => ctx.user.roles.includes(role))
        ? null
        : createApiError(403, 'forbidden', 'Unzureichende Berechtigung.', requestId)
      : requireRoles(ctx, roles, requestId),
});

export const ensurePlatformAccess = httpGuards.ensurePlatformAccess;
export const requireFreshReauth = (
  request: Request,
  ctx: RegistryRequestContext
): Response | null => isRegistryServiceContext(ctx) ? null : httpGuards.requireFreshReauth(request, ctx);
