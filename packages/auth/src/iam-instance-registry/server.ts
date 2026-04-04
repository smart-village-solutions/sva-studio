import { createSdkLogger, toJsonErrorResponse, withRequestContext } from '@sva/sdk/server';

import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.server.js';
import { buildLogContext } from '../shared/log-context.js';

import {
  activateInstanceInternal,
  archiveInstanceInternal,
  createInstanceInternal,
  getInstanceInternal,
  getInstanceKeycloakStatusInternal,
  listInstancesInternal,
  reconcileInstanceKeycloakInternal,
  suspendInstanceInternal,
  updateInstanceInternal,
} from './core.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });

const withRegistryRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'platform' }, work);

const withAuthenticatedRegistryHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withRegistryRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const logContext = buildLogContext('platform', { includeTraceId: true });
      logger.error('Instance registry request failed unexpectedly', {
        operation: 'instance_registry_request',
        endpoint: request.url,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        ...logContext,
      });
      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter Instanzverwaltungsfehler.', {
        requestId: logContext.request_id,
      });
    }
  });

export const listInstancesHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, listInstancesInternal);

export const getInstanceHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, getInstanceInternal);

export const createInstanceHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, createInstanceInternal);

export const updateInstanceHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, updateInstanceInternal);

export const getInstanceKeycloakStatusHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, getInstanceKeycloakStatusInternal);

export const reconcileInstanceKeycloakHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, reconcileInstanceKeycloakInternal);

export const activateInstanceHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, activateInstanceInternal);

export const suspendInstanceHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, suspendInstanceInternal);

export const archiveInstanceHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedRegistryHandler(request, archiveInstanceInternal);
