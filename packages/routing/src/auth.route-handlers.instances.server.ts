import * as authRuntimeRoutes from '@sva/auth-runtime/runtime-routes';

import type { AuthHandlers, AuthRoutePath } from './auth.route-handlers.types.js';

const routeHandler =
  (handler: (request: Request) => Promise<Response> | Response) =>
  async ({ request }: { request: Request }): Promise<Response> =>
    handler(request);

export const instanceAuthHandlerMap = {
  '/api/v1/iam/instances': {
    GET: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.listInstances),
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.createInstance),
  },
  '/api/v1/iam/instances/audit': {
    GET: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.getInstanceAuditRun),
  },
  '/api/v1/iam/instances/$instanceId': {
    GET: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.getInstance),
    PATCH: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.updateInstance),
  },
  '/api/v1/iam/instances/$instanceId/audit': {
    GET: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.getSingleInstanceAuditRun),
  },
  '/api/v1/iam/instances/$instanceId/keycloak/status': {
    GET: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.getInstanceKeycloakStatus),
  },
  '/api/v1/iam/instances/$instanceId/keycloak/preflight': {
    GET: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.getInstanceKeycloakPreflight),
  },
  '/api/v1/iam/instances/$instanceId/keycloak/plan': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.planInstanceKeycloakProvisioning),
  },
  '/api/v1/iam/instances/$instanceId/keycloak/execute': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.executeInstanceKeycloakProvisioning),
  },
  '/api/v1/iam/instances/$instanceId/keycloak/runs/$runId': {
    GET: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.getInstanceKeycloakProvisioningRun),
  },
  '/api/v1/iam/instances/$instanceId/keycloak/reconcile': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.reconcileInstanceKeycloak),
  },
  '/api/v1/iam/instances/$instanceId/tenant-iam/access-probe': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.probeTenantIamAccess),
  },
  '/api/v1/iam/instances/$instanceId/modules/assign': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.assignInstanceModule),
  },
  '/api/v1/iam/instances/$instanceId/modules/bootstrap-admin-structure': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.bootstrapInstanceAdminStructure),
  },
  '/api/v1/iam/instances/$instanceId/modules/revoke': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.revokeInstanceModule),
  },
  '/api/v1/iam/instances/$instanceId/modules/seed-iam-baseline': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.seedInstanceIamBaseline),
  },
  '/api/v1/iam/instances/$instanceId/activate': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.activateInstance),
  },
  '/api/v1/iam/instances/$instanceId/suspend': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.suspendInstance),
  },
  '/api/v1/iam/instances/$instanceId/archive': {
    POST: routeHandler(authRuntimeRoutes.instanceRegistryHandlers.archiveInstance),
  },
  '/api/v1/iam/contents': {
    GET: routeHandler(authRuntimeRoutes.listContentsHandler),
    POST: routeHandler(authRuntimeRoutes.createContentHandler),
  },
  '/api/v1/iam/contents/$contentId': {
    GET: routeHandler(authRuntimeRoutes.getContentHandler),
    PATCH: routeHandler(authRuntimeRoutes.updateContentHandler),
    DELETE: routeHandler(authRuntimeRoutes.deleteContentHandler),
  },
  '/api/v1/iam/contents/$contentId/history': {
    GET: routeHandler(authRuntimeRoutes.getContentHistoryHandler),
  },
  '/api/v1/iam/media': { GET: routeHandler(authRuntimeRoutes.listMediaHandler) },
  '/api/v1/iam/media/register': {
    POST: routeHandler(authRuntimeRoutes.registerBucketMediaHandler),
  },
  '/api/v1/iam/media/references': {
    GET: routeHandler(authRuntimeRoutes.listMediaReferencesHandler),
    PUT: routeHandler(authRuntimeRoutes.replaceMediaReferencesHandler),
  },
  '/api/v1/iam/media/upload-sessions': {
    POST: routeHandler(authRuntimeRoutes.initializeMediaUploadHandler),
  },
  '/api/v1/iam/media/upload-sessions/$uploadSessionId/complete': {
    POST: routeHandler(authRuntimeRoutes.completeMediaUploadHandler),
  },
  '/api/v1/iam/media/$assetId': {
    GET: routeHandler(authRuntimeRoutes.getMediaHandler),
    PATCH: routeHandler(authRuntimeRoutes.updateMediaHandler),
    DELETE: routeHandler(authRuntimeRoutes.deleteMediaHandler),
  },
  '/api/v1/iam/media/$assetId/usage': {
    GET: routeHandler(authRuntimeRoutes.getMediaUsageHandler),
  },
  '/api/v1/iam/media/$assetId/delivery': {
    GET: routeHandler(authRuntimeRoutes.getMediaDeliveryHandler),
  },
  '/api/v1/iam/legal-texts': {
    GET: routeHandler(authRuntimeRoutes.listLegalTextsHandler),
    POST: routeHandler(authRuntimeRoutes.createLegalTextHandler),
  },
  '/api/v1/iam/legal-texts/$legalTextVersionId': {
    PATCH: routeHandler(authRuntimeRoutes.updateLegalTextHandler),
    DELETE: routeHandler(authRuntimeRoutes.deleteLegalTextHandler),
  },
  '/api/v1/iam/admin/reconcile': {
    POST: routeHandler(authRuntimeRoutes.reconcileHandler),
  },
} satisfies Partial<Record<AuthRoutePath, AuthHandlers>>;
