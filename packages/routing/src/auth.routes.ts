import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';

/**
 * Auth Routes - Client-safe route definitions
 * 
 * These routes define the auth routing structure without server handlers.
 * Use @sva/routing/server for server-side route definitions with handlers.
 */

const authRoutePaths = [
  '/auth/login',
  '/auth/callback',
  '/auth/me',
  '/auth/logout',
  '/health/ready',
  '/health/live',
  '/iam/me/permissions',
  '/iam/authorize',
  '/api/v1/iam/users',
  '/api/v1/iam/users/$userId',
  '/api/v1/iam/users/$userId/timeline',
  '/api/v1/iam/users/bulk-deactivate',
  '/api/v1/iam/users/sync-keycloak',
  '/api/v1/iam/users/me/profile',
  '/api/v1/iam/organizations',
  '/api/v1/iam/organizations/$organizationId',
  '/api/v1/iam/organizations/$organizationId/memberships',
  '/api/v1/iam/organizations/$organizationId/memberships/$accountId',
  '/api/v1/iam/me/context',
  '/api/v1/iam/roles',
  '/api/v1/iam/roles/$roleId',
  '/api/v1/iam/groups',
  '/api/v1/iam/groups/$groupId',
  '/api/v1/iam/legal-texts',
  '/api/v1/iam/legal-texts/$legalTextVersionId',
  '/api/v1/iam/admin/reconcile',
  '/iam/governance/workflows',
  '/iam/governance/compliance/export',
  '/iam/me/data-export',
  '/iam/me/data-export/status',
  '/iam/me/data-subject-rights/requests',
  '/iam/me/profile',
  '/iam/me/optional-processing/execute',
  '/iam/admin/data-subject-rights/export',
  '/iam/admin/data-subject-rights/export/status',
  '/iam/admin/data-subject-rights/cases',
  '/iam/admin/data-subject-rights/legal-holds/apply',
  '/iam/admin/data-subject-rights/legal-holds/release',
  '/iam/admin/data-subject-rights/maintenance',
] as const;

/**
 * Client-safe authentication route factory
 * Creates a route structure without server handlers
 */
const createAuthRouteFactory = (path: string) => {
  return (rootRoute: RootRoute) => {
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      // NOTE: Server handlers are in auth.routes.server.ts
      // This client-safe version only defines routing structure
    });
  };
};

/**
 * Client-safe auth route factories for integration into app routers
 */
export const authRouteFactories = authRoutePaths.map((path) =>
  createAuthRouteFactory(path)
);

export { authRoutePaths };
