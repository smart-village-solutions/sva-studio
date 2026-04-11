import { createSdkLogger, toJsonErrorResponse, withRequestContext } from '@sva/sdk/server';

import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.server.js';
import { buildLogContext } from '../shared/log-context.js';

import {
  activateInstanceInternal,
  archiveInstanceInternal,
  createInstanceInternal,
  getInstanceInternal,
  listInstancesInternal,
  suspendInstanceInternal,
  updateInstanceInternal,
} from './core.js';
import {
  executeInstanceKeycloakProvisioningInternal,
  getInstanceKeycloakPreflightInternal,
  getInstanceKeycloakProvisioningRunInternal,
  getInstanceKeycloakStatusInternal,
  planInstanceKeycloakProvisioningInternal,
  reconcileInstanceKeycloakInternal,
} from './core-keycloak.js';

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
        reason_code: 'platform_scope_unhandled_failure',
        ...logContext,
      });
      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter Instanzverwaltungsfehler.', {
        requestId: logContext.request_id,
      });
    }
  });

export const instanceRegistryHandlers = {
  listInstances: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, listInstancesInternal),
  getInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, getInstanceInternal),
  createInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, createInstanceInternal),
  updateInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, updateInstanceInternal),
  getInstanceKeycloakStatus: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, getInstanceKeycloakStatusInternal),
  getInstanceKeycloakPreflight: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, getInstanceKeycloakPreflightInternal),
  planInstanceKeycloakProvisioning: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, planInstanceKeycloakProvisioningInternal),
  executeInstanceKeycloakProvisioning: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, executeInstanceKeycloakProvisioningInternal),
  getInstanceKeycloakProvisioningRun: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, getInstanceKeycloakProvisioningRunInternal),
  reconcileInstanceKeycloak: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, reconcileInstanceKeycloakInternal),
  activateInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, activateInstanceInternal),
  suspendInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, suspendInstanceInternal),
  archiveInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, archiveInstanceInternal),
};

export const listInstancesHandler = instanceRegistryHandlers.listInstances;
export const getInstanceHandler = instanceRegistryHandlers.getInstance;
export const createInstanceHandler = instanceRegistryHandlers.createInstance;
export const updateInstanceHandler = instanceRegistryHandlers.updateInstance;
export const getInstanceKeycloakStatusHandler = instanceRegistryHandlers.getInstanceKeycloakStatus;
export const getInstanceKeycloakPreflightHandler = instanceRegistryHandlers.getInstanceKeycloakPreflight;
export const planInstanceKeycloakProvisioningHandler = instanceRegistryHandlers.planInstanceKeycloakProvisioning;
export const executeInstanceKeycloakProvisioningHandler = instanceRegistryHandlers.executeInstanceKeycloakProvisioning;
export const getInstanceKeycloakProvisioningRunHandler = instanceRegistryHandlers.getInstanceKeycloakProvisioningRun;
export const reconcileInstanceKeycloakHandler = instanceRegistryHandlers.reconcileInstanceKeycloak;
export const activateInstanceHandler = instanceRegistryHandlers.activateInstance;
export const suspendInstanceHandler = instanceRegistryHandlers.suspendInstance;
export const archiveInstanceHandler = instanceRegistryHandlers.archiveInstance;
