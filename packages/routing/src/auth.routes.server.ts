import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';

import { accountAuthHandlerMap } from './auth.route-handlers.account.server.js';
import { instanceAuthHandlerMap } from './auth.route-handlers.instances.server.js';
import type { AuthHandlers, AuthRoutePath, RouteGuardLogger } from './auth.route-handlers.types.js';
import { governanceAuthHandlerMap } from './auth.routes.server.handlers.js';
import {
  dispatchRouteRequest,
  resolveRoutePathForRequestPath as resolveMappedRoutePathForRequestPath,
  verifyRouteHandlerCoverage,
  wrapHandlersWithJsonErrorBoundary,
} from './auth.route-runtime.server.js';
import { authRoutePaths } from './auth.routes.js';

type CreateRouteOptions = Parameters<typeof createRoute>[0];

const healthCheckRoutes = new Set<AuthRoutePath>([
  '/health/ready',
  '/health/live',
  '/api/v1/iam/health/ready',
  '/api/v1/iam/health/live',
]);

const authHandlerMap: Record<AuthRoutePath, AuthHandlers> = {
  ...accountAuthHandlerMap,
  ...instanceAuthHandlerMap,
  ...governanceAuthHandlerMap,
};

const isAuthRoutePath = (value: string): value is AuthRoutePath =>
  (authRoutePaths as readonly string[]).includes(value);

export const resolveAuthRoutePathForRequestPath = (pathname: string): AuthRoutePath | null =>
  resolveMappedRoutePathForRequestPath(authRoutePaths, pathname);

export const verifyAuthRouteHandlerCoverage = (
  paths: readonly string[],
  handlers: Record<string, AuthHandlers>,
  log?: RouteGuardLogger
): void => verifyRouteHandlerCoverage(paths, handlers, log);

export const resolveAuthHandlers = (path: string): AuthHandlers => {
  if (!isAuthRoutePath(path)) {
    throw new Error(`Unknown auth route path: ${path}`);
  }
  return authHandlerMap[path];
};

verifyAuthRouteHandlerCoverage(authRoutePaths, authHandlerMap);

export const dispatchAuthRouteRequest = (request: Request): Promise<Response | null> =>
  dispatchRouteRequest({
    request,
    resolveRoutePathForRequestPath: resolveAuthRoutePathForRequestPath,
    resolveHandlers: resolveAuthHandlers,
    suppressMethodNotAllowedLogging: (path) => healthCheckRoutes.has(path),
  });

const createAuthServerRouteFactory =
  (path: AuthRoutePath) =>
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      server: {
        handlers: wrapHandlersWithJsonErrorBoundary(resolveAuthHandlers(path), path),
      },
    } as unknown as CreateRouteOptions);

export const authServerRouteFactories = authRoutePaths.map(createAuthServerRouteFactory);

export { wrapHandlersWithJsonErrorBoundary };
export { authRoutePaths } from './auth.routes.js';
