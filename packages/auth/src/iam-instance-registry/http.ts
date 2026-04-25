import { createApiError } from '../iam-account-management/api-helpers.js';
import { requireRoles } from '../iam-account-management/shared-actor-resolution.js';
import { getWorkspaceContext, isCanonicalAuthHost } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { resolveEffectiveRequestHost } from '../request-hosts.js';
export {
  createInstanceSchema,
  executeKeycloakProvisioningSchema,
  listQuerySchema,
  readDetailInstanceId,
  readKeycloakRunId,
  reconcileKeycloakSchema,
  statusMutationSchema,
  updateInstanceSchema,
} from '@sva/instance-registry/http-contracts';

const ADMIN_ROLES = new Set(['instance_registry_admin']);

const isRootHostRequest = (request: Request): boolean => isCanonicalAuthHost(resolveEffectiveRequestHost(request));

export const ensurePlatformAccess = (request: Request, ctx: AuthenticatedRequestContext): Response | null => {
  if (!isRootHostRequest(request)) {
    return createApiError(403, 'forbidden', 'Globale Instanzverwaltung ist nur auf dem Root-Host erlaubt.', getWorkspaceContext().requestId);
  }

  return requireRoles(ctx, ADMIN_ROLES, getWorkspaceContext().requestId);
};

export const requireFreshReauth = (request: Request): Response | null => {
  const header = request.headers.get('x-sva-reauth-confirmed');
  if (header?.toLowerCase() === 'true') {
    return null;
  }

  return createApiError(403, 'reauth_required', 'Frische Re-Authentisierung ist für diese Mutation erforderlich.', getWorkspaceContext().requestId);
};
