import { asApiItem, createApiError, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf as validateSessionCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../db.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import type { InstanceStatus } from '@sva/core';
import {
  createInstanceMutationErrorMapper,
  createInstanceRegistryMutationHttpHandlers,
} from '@sva/instance-registry/http-mutation-handlers';
import type { RegistryRequestContext } from './auth-context.js';
import { isAuthenticatedRegistryServiceRequest } from './service-token.js';
import { confirmCriticalRegistryMutation } from './confirmation.js';
import {
  ensurePlatformAccess,
  requireFreshReauth,
} from './http.js';
import { parseRegistryRequestBody } from './request-parsing.js';
import { withRegistryService, withScopedRegistryService } from './repository.js';

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

const mutationHandlers = createInstanceRegistryMutationHttpHandlers<RegistryRequestContext>({
  getRequestId,
  getActor: (ctx) => ({ id: ctx.user.id }),
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  jsonResponse,
  asApiItem,
  parseRequestBody: parseRegistryRequestBody,
  requireIdempotencyKey,
  ensurePlatformAccess,
  validateCsrf: (request, requestId) =>
    isAuthenticatedRegistryServiceRequest(request) ? null : validateSessionCsrf(request, requestId),
  requireFreshReauth,
  withRegistryService,
  withScopedRegistryService,
  confirmCriticalMutation: confirmCriticalRegistryMutation,
});

export const mapInstanceMutationError = createInstanceMutationErrorMapper({
  getRequestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
});

export const reconcileInstanceKeycloakMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.reconcileInstanceKeycloak(request, ctx);

export const executeInstanceKeycloakProvisioningMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.executeInstanceKeycloakProvisioning(request, ctx);

export const rotateInstanceSecretMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.rotateInstanceSecret(request, ctx);

export const assignInstanceModuleMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.assignModule(request, ctx);

export const bootstrapInstanceAdminStructureMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.bootstrapAdminStructure(request, ctx);

export const revokeInstanceModuleMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.revokeModule(request, ctx);

export const seedInstanceIamBaselineMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.seedIamBaseline(request, ctx);

export const probeTenantIamAccessMutation = (
  request: Request,
  ctx: RegistryRequestContext
): Promise<Response> => mutationHandlers.probeTenantIamAccess(request, ctx);

export const mutateInstanceStatus = (
  request: Request,
  ctx: RegistryRequestContext,
  nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
): Promise<Response> => mutationHandlers.mutateInstanceStatus(request, ctx, nextStatus);
