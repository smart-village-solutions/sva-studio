import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';
import * as authRuntimeRoutes from '@sva/auth-runtime/runtime-routes';

import { accountAuthHandlerMap } from './auth.route-handlers.account.server.js';
import { instanceAuthHandlerMap } from './auth.route-handlers.instances.server.js';
import type { AuthHandlers, AuthRoutePath, RouteGuardLogger } from './auth.route-handlers.types.js';
import {
  createMethodNotAllowedHandler,
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

const routeHandler =
  (handler: (request: Request) => Promise<Response> | Response) =>
  async ({ request }: { request: Request }): Promise<Response> =>
    handler(request);

const governanceAuthHandlerMap = {
  '/iam/governance/workflows': {
    GET: routeHandler(authRuntimeRoutes.listGovernanceCasesHandler),
    POST: routeHandler(authRuntimeRoutes.governanceWorkflowHandler),
  },
  '/iam/governance/compliance/export': {
    GET: routeHandler(authRuntimeRoutes.governanceComplianceExportHandler),
  },
  '/iam/me/data-export': {
    GET: createMethodNotAllowedHandler('/iam/me/data-export', 'POST'),
    POST: routeHandler(authRuntimeRoutes.dataExportHandler),
  },
  '/iam/me/data-export/status': {
    GET: routeHandler(authRuntimeRoutes.dataExportStatusHandler),
  },
  '/iam/me/data-subject-rights/requests': {
    GET: routeHandler(authRuntimeRoutes.getMyDataSubjectRightsHandler),
    POST: routeHandler(authRuntimeRoutes.dataSubjectRequestHandler),
  },
  '/iam/me/legal-texts/pending': {
    GET: routeHandler(authRuntimeRoutes.listPendingLegalTextsHandler),
  },
  '/iam/me/profile': {
    POST: routeHandler(authRuntimeRoutes.profileCorrectionHandler),
  },
  '/iam/me/optional-processing/execute': {
    POST: routeHandler(authRuntimeRoutes.optionalProcessingExecuteHandler),
  },
  '/iam/admin/data-subject-rights/export': {
    GET: createMethodNotAllowedHandler('/iam/admin/data-subject-rights/export', 'POST'),
    POST: routeHandler(authRuntimeRoutes.adminDataExportHandler),
  },
  '/iam/admin/data-subject-rights/export/status': {
    GET: routeHandler(authRuntimeRoutes.adminDataExportStatusHandler),
  },
  '/iam/admin/data-subject-rights/cases': {
    GET: routeHandler(authRuntimeRoutes.listAdminDataSubjectRightsCasesHandler),
  },
  '/iam/admin/data-subject-rights/legal-holds/apply': {
    POST: routeHandler(authRuntimeRoutes.legalHoldApplyHandler),
  },
  '/iam/admin/data-subject-rights/legal-holds/release': {
    POST: routeHandler(authRuntimeRoutes.legalHoldReleaseHandler),
  },
  '/iam/admin/data-subject-rights/maintenance': {
    POST: routeHandler(authRuntimeRoutes.dataSubjectMaintenanceHandler),
  },
} satisfies Partial<Record<AuthRoutePath, AuthHandlers>>;

const authHandlerMap = {
  ...accountAuthHandlerMap,
  ...instanceAuthHandlerMap,
  ...governanceAuthHandlerMap,
} satisfies Record<AuthRoutePath, AuthHandlers>;

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

const createAuthServerRouteFactory = (path: AuthRoutePath) => {
  return (rootRoute: RootRoute) => {
    const routeOptions = {
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      server: {
        handlers: wrapHandlersWithJsonErrorBoundary(resolveAuthHandlers(path), path),
      },
    };

    return createRoute(routeOptions as unknown as CreateRouteOptions);
  };
};

export const authServerRouteFactories = authRoutePaths.map((path) =>
  createAuthServerRouteFactory(path)
);

export { wrapHandlersWithJsonErrorBoundary };
export { authRoutePaths } from './auth.routes.js';
