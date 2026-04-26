import { asApiItem, createApiError } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import { createInstanceRegistryKeycloakHttpHandlers } from '@sva/instance-registry/http-keycloak-handlers';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { ensurePlatformAccess, requireFreshReauth } from './http.js';
import { executeInstanceKeycloakProvisioningMutation, mapInstanceMutationError, reconcileInstanceKeycloakMutation } from './core-mutations.js';
import { withRegistryService } from './repository.js';

const keycloakHttpHandlers = createInstanceRegistryKeycloakHttpHandlers<AuthenticatedRequestContext>({
  getRequestId: () => getWorkspaceContext().requestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  jsonResponse,
  asApiItem,
  mapMutationError: mapInstanceMutationError,
  ensurePlatformAccess,
  validateCsrf,
  requireFreshReauth,
  withRegistryService,
});

export const getInstanceKeycloakStatusInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => keycloakHttpHandlers.getInstanceKeycloakStatus(request, ctx);

export const getInstanceKeycloakPreflightInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => keycloakHttpHandlers.getInstanceKeycloakPreflight(request, ctx);

export const planInstanceKeycloakProvisioningInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => keycloakHttpHandlers.planInstanceKeycloakProvisioning(request, ctx);

export const executeInstanceKeycloakProvisioningInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => executeInstanceKeycloakProvisioningMutation(request, ctx);

export const getInstanceKeycloakProvisioningRunInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => keycloakHttpHandlers.getInstanceKeycloakProvisioningRun(request, ctx);

export const reconcileInstanceKeycloakInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => reconcileInstanceKeycloakMutation(request, ctx);
