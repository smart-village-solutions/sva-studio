import { asApiItem, asApiList, createApiError, requireIdempotencyKey } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { jsonResponse } from '../db.js';
import { buildLogContext } from '../log-context.js';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { createInstanceRegistryHttpHandlers } from '@sva/instance-registry/http-instance-handlers';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { ensurePlatformAccess, requireFreshReauth } from './http.js';
import { mapInstanceMutationError, mutateInstanceStatus } from './core-mutations.js';
import { parseRegistryRequestBody } from './request-parsing.js';
import { withRegistryService } from './repository.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });

const instanceHttpHandlers = createInstanceRegistryHttpHandlers<AuthenticatedRequestContext>({
  getRequestId: () => getWorkspaceContext().requestId,
  getActor: (ctx) => ({ id: ctx.user.id }),
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  jsonResponse,
  asApiItem,
  asApiList,
  parseRequestBody: parseRegistryRequestBody,
  requireIdempotencyKey,
  mapMutationError: mapInstanceMutationError,
  ensurePlatformAccess,
  validateCsrf,
  requireFreshReauth,
  withRegistryService,
  onInstanceProvisioningRequested: ({ instanceId, primaryHostname, actorId }) => {
    logger.info('Instance provisioning requested', {
      operation: 'instance_create',
      instance_id: instanceId,
      primary_hostname: primaryHostname,
      actor_id: actorId,
      ...buildLogContext('platform', { includeTraceId: true }),
    });
  },
});

export const listInstancesInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  return instanceHttpHandlers.listInstances(request, ctx);
};

export const getInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  return instanceHttpHandlers.getInstance(request, ctx);
};

export const createInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  return instanceHttpHandlers.createInstance(request, ctx);
};

export const updateInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  return instanceHttpHandlers.updateInstance(request, ctx);
};

export const activateInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'active');

export const suspendInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'suspended');

export const archiveInstanceInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> =>
  mutateInstanceStatus(request, ctx, 'archived');
