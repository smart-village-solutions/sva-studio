import { createSdkLogger, toJsonErrorResponse, withRequestContext } from '@sva/server-runtime';

import { withAuthenticatedUser } from '../middleware.js';
import { buildLogContext } from '../log-context.js';

import { REGISTRY_ACTIONS, type RegistryActionId, type RegistryRequestContext } from './auth-context.js';
import { prepareInstanceConfirmationInternal } from './confirmation.js';
import {
  authenticateRegistryServiceToken,
  markAuthenticatedRegistryServiceRequest,
  readBearerToken,
} from './service-token.js';

import {
  activateInstanceInternal,
  assignInstanceModuleInternal,
  archiveInstanceInternal,
  bootstrapInstanceAdminStructureInternal,
  createInstanceInternal,
  getInstanceInternal,
  listInstancesInternal,
  revokeInstanceModuleInternal,
  seedInstanceIamBaselineInternal,
  suspendInstanceInternal,
  updateInstanceInternal,
} from './core.js';
import {
  executeInstanceKeycloakProvisioningInternal,
  getInstanceAuditRunInternal,
  getInstanceKeycloakPreflightInternal,
  getInstanceKeycloakProvisioningRunInternal,
  getInstanceKeycloakStatusInternal,
  getSingleInstanceAuditRunInternal,
  planInstanceKeycloakProvisioningInternal,
  probeTenantIamAccessInternal,
  reconcileInstanceKeycloakInternal,
  rotateInstanceSecretInternal,
} from './core-keycloak.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });

const withRegistryRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'platform' }, work);

const withAuthenticatedRegistryHandler = (
  request: Request,
  actionId: RegistryActionId,
  handler: (request: Request, ctx: RegistryRequestContext) => Promise<Response>
): Promise<Response> =>
  withRegistryRequestContext(request, async () => {
    try {
      const bearerToken = readBearerToken(request);
      if (bearerToken !== undefined) {
        if (bearerToken === null) {
          const requestId = buildLogContext('platform', { includeTraceId: true }).request_id;
          return toJsonErrorResponse(401, 'invalid_service_token', 'Service-Authentisierung fehlgeschlagen.', {
            requestId,
          });
        }
        const resolution = await authenticateRegistryServiceToken(bearerToken, actionId);
        if (resolution.kind === 'response') return resolution.response;
        markAuthenticatedRegistryServiceRequest(request);
        const logContext = buildLogContext('platform', { includeTraceId: true });
        logger.info('Instance registry service action authenticated', {
          operation: 'instance_registry_service_action',
          auth_kind: resolution.context.authKind,
          actor_id: resolution.context.user.id,
          action_id: actionId,
          request_id: logContext.request_id,
        });
        return await handler(request, resolution.context);
      }
      return await withAuthenticatedUser(request, (ctx) =>
        handler(request, { ...ctx, authKind: 'session' })
      );
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
  prepareInstanceConfirmation: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, REGISTRY_ACTIONS.confirmationPrepare, prepareInstanceConfirmationInternal),
  listInstances: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.list', listInstancesInternal),
  getInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.read', getInstanceInternal),
  createInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.create', createInstanceInternal),
  updateInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.update', updateInstanceInternal),
  getInstanceAuditRun: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.audit.read', getInstanceAuditRunInternal),
  getInstanceKeycloakStatus: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.diagnose', getInstanceKeycloakStatusInternal),
  getSingleInstanceAuditRun: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.audit.read', getSingleInstanceAuditRunInternal),
  getInstanceKeycloakPreflight: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.diagnose', getInstanceKeycloakPreflightInternal),
  planInstanceKeycloakProvisioning: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.provision.plan', planInstanceKeycloakProvisioningInternal),
  executeInstanceKeycloakProvisioning: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.provision.execute', executeInstanceKeycloakProvisioningInternal),
  rotateInstanceSecret: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, REGISTRY_ACTIONS.secretRotate, rotateInstanceSecretInternal),
  getInstanceKeycloakProvisioningRun: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.provision.run.read', getInstanceKeycloakProvisioningRunInternal),
  probeTenantIamAccess: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.diagnose', probeTenantIamAccessInternal),
  reconcileInstanceKeycloak: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.reconcile', reconcileInstanceKeycloakInternal),
  activateInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.status.activate', activateInstanceInternal),
  assignInstanceModule: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.module.assign', assignInstanceModuleInternal),
  bootstrapInstanceAdminStructure: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.admin.bootstrap', bootstrapInstanceAdminStructureInternal),
  revokeInstanceModule: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.module.revoke', revokeInstanceModuleInternal),
  seedInstanceIamBaseline: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.iam.baseline.seed', seedInstanceIamBaselineInternal),
  suspendInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.status.suspend', suspendInstanceInternal),
  archiveInstance: async (request: Request): Promise<Response> =>
    withAuthenticatedRegistryHandler(request, 'instance.status.archive', archiveInstanceInternal),
};
