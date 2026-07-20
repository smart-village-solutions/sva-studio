import { asApiItem, createApiError } from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../db.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import {
  createInstanceRegistryAuditHttpHandlers,
  createInstanceRegistryKeycloakHttpHandlers,
} from '@sva/instance-registry';

import type { RegistryRequestContext } from './auth-context.js';
import { isAuthenticatedRegistryServiceRequest } from './service-token.js';
import { ensurePlatformAccess, requireFreshReauth } from './http.js';
import {
  executeInstanceKeycloakProvisioningMutation,
  mapInstanceMutationError,
  probeTenantIamAccessMutation,
  reconcileInstanceKeycloakMutation,
  rotateInstanceSecretMutation,
} from './core-mutations.js';
import { withRegistryService } from './repository.js';

const keycloakHttpHandlers = createInstanceRegistryKeycloakHttpHandlers<RegistryRequestContext>({
  getRequestId: () => getWorkspaceContext().requestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  jsonResponse,
  asApiItem,
  mapMutationError: mapInstanceMutationError,
  ensurePlatformAccess,
  validateCsrf: (request, requestId) =>
    isAuthenticatedRegistryServiceRequest(request) ? null : validateSessionCsrf(request, requestId),
  requireFreshReauth,
  withRegistryService,
});

const auditHttpHandlers = createInstanceRegistryAuditHttpHandlers<RegistryRequestContext>({
  getRequestId: () => getWorkspaceContext().requestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  jsonResponse,
  asApiItem,
  mapReadError: mapInstanceMutationError,
  ensurePlatformAccess,
  withRegistryService,
  getActorId: (ctx) => ctx.user.id,
});

export const getInstanceKeycloakStatusInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => keycloakHttpHandlers.getInstanceKeycloakStatus(request, ctx);

export const getInstanceAuditRunInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => auditHttpHandlers.getInstanceAuditRun(request, ctx);

export const getSingleInstanceAuditRunInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => auditHttpHandlers.getSingleInstanceAuditRun(request, ctx);

export const getInstanceKeycloakPreflightInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => keycloakHttpHandlers.getInstanceKeycloakPreflight(request, ctx);

export const planInstanceKeycloakProvisioningInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => keycloakHttpHandlers.planInstanceKeycloakProvisioning(request, ctx);

export const executeInstanceKeycloakProvisioningInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => executeInstanceKeycloakProvisioningMutation(request, ctx);

export const rotateInstanceSecretInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => rotateInstanceSecretMutation(request, ctx);

export const getInstanceKeycloakProvisioningRunInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => keycloakHttpHandlers.getInstanceKeycloakProvisioningRun(request, ctx);

export const reconcileInstanceKeycloakInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => reconcileInstanceKeycloakMutation(request, ctx);

export const probeTenantIamAccessInternal = async (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => probeTenantIamAccessMutation(request, ctx);
