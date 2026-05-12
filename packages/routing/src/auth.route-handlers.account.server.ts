import * as authRuntimeHealth from '@sva/auth-runtime/runtime-health';
import * as authRuntimeRoutes from '@sva/auth-runtime/runtime-routes';

import type { AuthHandlers, AuthRoutePath } from './auth.route-handlers.types.js';

const routeHandler =
  (handler: (request: Request) => Promise<Response> | Response) =>
  async ({ request }: { request: Request }): Promise<Response> =>
    handler(request);

export const accountAuthHandlerMap = {
  '/auth/login': { GET: routeHandler(authRuntimeRoutes.loginHandler) },
  '/auth/dev-login': { POST: routeHandler(authRuntimeRoutes.devLoginHandler) },
  '/auth/callback': { GET: routeHandler(authRuntimeRoutes.callbackHandler) },
  '/auth/me': { GET: routeHandler(authRuntimeRoutes.meHandler) },
  '/auth/dev-logout': { POST: routeHandler(authRuntimeRoutes.devLogoutHandler) },
  '/auth/logout': { POST: routeHandler(authRuntimeRoutes.logoutHandler) },
  '/health/ready': { GET: routeHandler(authRuntimeHealth.healthReadyHandler) },
  '/health/live': { GET: routeHandler(authRuntimeHealth.healthLiveHandler) },
  '/api/v1/iam/health/ready': { GET: routeHandler(authRuntimeHealth.healthReadyHandler) },
  '/api/v1/iam/health/live': { GET: routeHandler(authRuntimeHealth.healthLiveHandler) },
  '/iam/me/permissions': { GET: routeHandler(authRuntimeRoutes.mePermissionsHandler) },
  '/iam/authorize': { POST: routeHandler(authRuntimeRoutes.authorizeHandler) },
  '/api/v1/iam/users': {
    GET: routeHandler(authRuntimeRoutes.listUsersHandler),
    POST: routeHandler(authRuntimeRoutes.createUserHandler),
  },
  '/api/v1/iam/users/$userId': {
    GET: routeHandler(authRuntimeRoutes.getUserHandler),
    PATCH: routeHandler(authRuntimeRoutes.updateUserHandler),
    DELETE: routeHandler(authRuntimeRoutes.deactivateUserHandler),
  },
  '/api/v1/iam/users/$userId/send-password-setup-email': {
    POST: routeHandler(authRuntimeRoutes.sendPasswordSetupEmailHandler),
  },
  '/api/v1/iam/users/$userId/timeline': {
    GET: routeHandler(authRuntimeRoutes.getUserTimelineHandler),
  },
  '/api/v1/iam/users/bulk-deactivate': {
    POST: routeHandler(authRuntimeRoutes.bulkDeactivateUsersHandler),
  },
  '/api/v1/iam/users/sync-keycloak': {
    POST: routeHandler(authRuntimeRoutes.syncUsersFromKeycloakHandler),
  },
  '/api/v1/iam/users/me/profile': {
    GET: routeHandler(authRuntimeRoutes.getMyProfileHandler),
    PATCH: routeHandler(authRuntimeRoutes.updateMyProfileHandler),
  },
  '/api/v1/iam/organizations': {
    GET: routeHandler(authRuntimeRoutes.listOrganizationsHandler),
    POST: routeHandler(authRuntimeRoutes.createOrganizationHandler),
  },
  '/api/v1/iam/organizations/$organizationId': {
    GET: routeHandler(authRuntimeRoutes.getOrganizationHandler),
    PATCH: routeHandler(authRuntimeRoutes.updateOrganizationHandler),
    DELETE: routeHandler(authRuntimeRoutes.deactivateOrganizationHandler),
  },
  '/api/v1/iam/organizations/$organizationId/memberships': {
    POST: routeHandler(authRuntimeRoutes.assignOrganizationMembershipHandler),
  },
  '/api/v1/iam/organizations/$organizationId/memberships/$accountId': {
    DELETE: routeHandler(authRuntimeRoutes.removeOrganizationMembershipHandler),
  },
  '/api/v1/iam/me/context': {
    GET: routeHandler(authRuntimeRoutes.getMyOrganizationContextHandler),
    PUT: routeHandler(authRuntimeRoutes.updateMyOrganizationContextHandler),
  },
  '/api/v1/iam/permissions': { GET: routeHandler(authRuntimeRoutes.listPermissionsHandler) },
  '/api/v1/iam/roles': {
    GET: routeHandler(authRuntimeRoutes.listRolesHandler),
    POST: routeHandler(authRuntimeRoutes.createRoleHandler),
  },
  '/api/v1/iam/roles/$roleId': {
    PATCH: routeHandler(authRuntimeRoutes.updateRoleHandler),
    DELETE: routeHandler(authRuntimeRoutes.deleteRoleHandler),
  },
  '/api/v1/iam/groups': {
    GET: routeHandler(authRuntimeRoutes.listGroupsHandler),
    POST: routeHandler(authRuntimeRoutes.createGroupHandler),
  },
  '/api/v1/iam/groups/$groupId': {
    GET: routeHandler(authRuntimeRoutes.getGroupHandler),
    PATCH: routeHandler(authRuntimeRoutes.updateGroupHandler),
    DELETE: routeHandler(authRuntimeRoutes.deleteGroupHandler),
  },
  '/api/v1/iam/groups/$groupId/roles': {
    POST: routeHandler(authRuntimeRoutes.assignGroupRoleHandler),
  },
  '/api/v1/iam/groups/$groupId/roles/$roleId': {
    DELETE: routeHandler(authRuntimeRoutes.removeGroupRoleHandler),
  },
  '/api/v1/iam/groups/$groupId/memberships': {
    POST: routeHandler(authRuntimeRoutes.assignGroupMembershipHandler),
    DELETE: routeHandler(authRuntimeRoutes.removeGroupMembershipHandler),
  },
} satisfies Partial<Record<AuthRoutePath, AuthHandlers>>;
