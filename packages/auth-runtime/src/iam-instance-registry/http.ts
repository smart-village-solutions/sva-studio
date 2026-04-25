import { createApiError } from '../iam-account-management/api-helpers.js';
import { requireRoles } from '../iam-account-management/shared-actor-resolution.js';
import { getWorkspaceContext, isCanonicalAuthHost } from '@sva/server-runtime';
import { createInstanceRegistryHttpGuards } from '@sva/instance-registry/http-guards';

import type { AuthenticatedRequestContext } from '../middleware.js';
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

const isRootHostRequest = (request: Request): boolean => isCanonicalAuthHost(resolveEffectiveRequestHost(request));

const httpGuards = createInstanceRegistryHttpGuards<AuthenticatedRequestContext>({
  getRequestId: () => getWorkspaceContext().requestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  isRootHostRequest,
  requireRoles,
});

export const ensurePlatformAccess = httpGuards.ensurePlatformAccess;
export const requireFreshReauth = httpGuards.requireFreshReauth;
