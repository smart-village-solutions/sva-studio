import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';

/**
 * Auth Routes - Client-safe route definitions
 * 
 * These routes define the auth routing structure without server handlers.
 * Use @sva/routing/server for server-side route definitions with handlers.
 */

const authRoutePaths = ['/auth/login', '/auth/callback', '/auth/me', '/auth/logout'] as const;

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
