import { asApiItem, createApiError, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../db.js';
import { getWorkspaceContext } from '@sva/server-runtime';
import type { InstanceStatus } from '@sva/core';
import {
  createInstanceMutationErrorMapper,
  createInstanceRegistryMutationHttpHandlers,
} from '@sva/instance-registry/http-mutation-handlers';
import type { AuthenticatedRequestContext } from '../middleware.js';
import {
  ensurePlatformAccess,
  requireFreshReauth,
} from './http.js';
import { parseRegistryRequestBody } from './request-parsing.js';
import { withRegistryService } from './repository.js';

const getRequestId = (): string | undefined => getWorkspaceContext().requestId;

const mutationHandlers = createInstanceRegistryMutationHttpHandlers<AuthenticatedRequestContext>({
  getRequestId,
  getActor: (ctx) => ({ id: ctx.user.id }),
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  jsonResponse,
  asApiItem,
  parseRequestBody: parseRegistryRequestBody,
  requireIdempotencyKey,
  ensurePlatformAccess,
  validateCsrf,
  requireFreshReauth,
  withRegistryService,
});

export const mapInstanceMutationError = createInstanceMutationErrorMapper({
  getRequestId,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
});

export const reconcileInstanceKeycloakMutation = (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => mutationHandlers.reconcileInstanceKeycloak(request, ctx);

export const executeInstanceKeycloakProvisioningMutation = (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => mutationHandlers.executeInstanceKeycloakProvisioning(request, ctx);

export const probeTenantIamAccessMutation = (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => mutationHandlers.probeTenantIamAccess(request, ctx);

export const mutateInstanceStatus = (
  request: Request,
  ctx: AuthenticatedRequestContext,
  nextStatus: Extract<InstanceStatus, 'active' | 'suspended' | 'archived'>
): Promise<Response> => mutationHandlers.mutateInstanceStatus(request, ctx, nextStatus);
