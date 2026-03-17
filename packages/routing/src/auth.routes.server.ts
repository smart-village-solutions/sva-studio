import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';
import {
  createSdkLogger,
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  getHeadersFromRequest,
  toJsonErrorResponse,
} from '@sva/sdk/server';
import { authRoutePaths } from './auth.routes';

type AuthHandlers = {
  GET?: (ctx: { request: Request }) => Promise<Response> | Response;
  POST?: (ctx: { request: Request }) => Promise<Response> | Response;
  PUT?: (ctx: { request: Request }) => Promise<Response> | Response;
  PATCH?: (ctx: { request: Request }) => Promise<Response> | Response;
  DELETE?: (ctx: { request: Request }) => Promise<Response> | Response;
};

type AuthRoutePath = (typeof authRoutePaths)[number];
type RouteGuardLogger = {
  warn: (message: string, meta: Record<string, unknown>) => void;
};

const logger = createSdkLogger({ component: 'auth-routing', level: 'info' });

const methodNotAllowedJson = (allow: string, requestId?: string) =>
  new Response(
    JSON.stringify({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
      ...(requestId ? { requestId } : {}),
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        Allow: allow,
        ...(requestId ? { 'X-Request-Id': requestId } : {}),
      },
    }
  );

const readWorkspaceIdFromRequest = (request: Request): string => {
  const headers = getHeadersFromRequest(request);
  const fromHeaders =
    headers['x-workspace-id'] ??
    headers['x-sva-workspace-id'] ??
    headers['x-instance-id'];
  if (typeof fromHeaders === 'string' && fromHeaders.trim().length > 0) {
    return fromHeaders.trim();
  }

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('instanceId');
  if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) {
    return fromQuery.trim();
  }

  return 'default';
};

/**
 * Exhaustive handler mapping for all auth route paths.
 * Adding a path to `authRoutePaths` without a corresponding handler entry
 * causes a compile error via `satisfies`.
 */
const authHandlerMap = {
  '/auth/login': {
    GET: async () => {
      const mod = await import('@sva/auth/server');
      return mod.loginHandler();
    },
  },
  '/auth/callback': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.callbackHandler(request);
    },
  },
  '/auth/me': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.meHandler(request);
    },
  },
  '/auth/logout': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.logoutHandler(request);
    },
  },
  '/health/ready': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.healthReadyHandler(request);
    },
  },
  '/health/live': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.healthLiveHandler(request);
    },
  },
  '/iam/me/permissions': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.mePermissionsHandler(request);
    },
  },
  '/iam/authorize': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.authorizeHandler(request);
    },
  },
  '/api/v1/iam/users': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.listUsersHandler(request);
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.createUserHandler(request);
    },
  },
  '/api/v1/iam/users/$userId': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.getUserHandler(request);
    },
    PATCH: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.updateUserHandler(request);
    },
    DELETE: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.deactivateUserHandler(request);
    },
  },
  '/api/v1/iam/users/$userId/timeline': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.getUserTimelineHandler(request);
    },
  },
  '/api/v1/iam/users/bulk-deactivate': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.bulkDeactivateUsersHandler(request);
    },
  },
  '/api/v1/iam/users/sync-keycloak': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.syncUsersFromKeycloakHandler(request);
    },
  },
  '/api/v1/iam/users/me/profile': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.getMyProfileHandler(request);
    },
    PATCH: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.updateMyProfileHandler(request);
    },
  },
  '/api/v1/iam/organizations': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.listOrganizationsHandler(request);
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.createOrganizationHandler(request);
    },
  },
  '/api/v1/iam/organizations/$organizationId': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.getOrganizationHandler(request);
    },
    PATCH: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.updateOrganizationHandler(request);
    },
    DELETE: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.deactivateOrganizationHandler(request);
    },
  },
  '/api/v1/iam/organizations/$organizationId/memberships': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.assignOrganizationMembershipHandler(request);
    },
  },
  '/api/v1/iam/organizations/$organizationId/memberships/$accountId': {
    DELETE: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.removeOrganizationMembershipHandler(request);
    },
  },
  '/api/v1/iam/me/context': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.getMyOrganizationContextHandler(request);
    },
    PUT: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.updateMyOrganizationContextHandler(request);
    },
  },
  '/api/v1/iam/roles': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.listRolesHandler(request);
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.createRoleHandler(request);
    },
  },
  '/api/v1/iam/roles/$roleId': {
    PATCH: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.updateRoleHandler(request);
    },
    DELETE: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.deleteRoleHandler(request);
    },
  },
  '/api/v1/iam/legal-texts': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.listLegalTextsHandler(request);
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.createLegalTextHandler(request);
    },
  },
  '/api/v1/iam/legal-texts/$legalTextVersionId': {
    PATCH: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.updateLegalTextHandler(request);
    },
  },
  '/api/v1/iam/admin/reconcile': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.reconcileHandler(request);
    },
  },
  '/iam/governance/workflows': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.listGovernanceCasesHandler(request);
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.governanceWorkflowHandler(request);
    },
  },
  '/iam/governance/compliance/export': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.governanceComplianceExportHandler(request);
    },
  },
  '/iam/me/data-export': {
    GET: async ({ request }) => {
      return methodNotAllowedJson('POST', extractRequestIdFromHeaders(getHeadersFromRequest(request)));
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.dataExportHandler(request);
    },
  },
  '/iam/me/data-export/status': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.dataExportStatusHandler(request);
    },
  },
  '/iam/me/data-subject-rights/requests': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.getMyDataSubjectRightsHandler(request);
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.dataSubjectRequestHandler(request);
    },
  },
  '/iam/me/profile': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.profileCorrectionHandler(request);
    },
  },
  '/iam/me/optional-processing/execute': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.optionalProcessingExecuteHandler(request);
    },
  },
  '/iam/admin/data-subject-rights/export': {
    GET: async ({ request }) => {
      return methodNotAllowedJson('POST', extractRequestIdFromHeaders(getHeadersFromRequest(request)));
    },
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.adminDataExportHandler(request);
    },
  },
  '/iam/admin/data-subject-rights/export/status': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.adminDataExportStatusHandler(request);
    },
  },
  '/iam/admin/data-subject-rights/cases': {
    GET: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.listAdminDataSubjectRightsCasesHandler(request);
    },
  },
  '/iam/admin/data-subject-rights/legal-holds/apply': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.legalHoldApplyHandler(request);
    },
  },
  '/iam/admin/data-subject-rights/legal-holds/release': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.legalHoldReleaseHandler(request);
    },
  },
  '/iam/admin/data-subject-rights/maintenance': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.dataSubjectMaintenanceHandler(request);
    },
  },
} satisfies Record<AuthRoutePath, AuthHandlers>;

const isAuthRoutePath = (value: string): value is AuthRoutePath =>
  (authRoutePaths as readonly string[]).includes(value);

const getErrorType = (error: unknown): string =>
  error instanceof Error ? error.constructor.name : typeof error;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const writeLoggerFallback = (input: {
  method: string;
  route: string;
  workspaceId: string;
  requestId?: string;
  traceId?: string;
  errorType: string;
  errorMessage: string;
}): void => {
  const payload = JSON.stringify({
    level: 'error',
    component: 'auth-routing',
    message: 'Auth route error logging failed',
    method: input.method,
    route: input.route,
    workspace_id: input.workspaceId,
    request_id: input.requestId,
    trace_id: input.traceId,
    error_type: input.errorType,
    error_message: input.errorMessage,
  });
  process.stderr.write(`${payload}\n`);
};

export const verifyAuthRouteHandlerCoverage = (
  paths: readonly string[],
  handlers: Record<string, AuthHandlers>,
  log: RouteGuardLogger = logger
): void => {
  const handlerKeys = Object.keys(handlers);
  const missingPaths = paths.filter((path) => !handlerKeys.includes(path));
  const extraPaths = handlerKeys.filter((path) => !paths.includes(path));

  if (missingPaths.length === 0 && extraPaths.length === 0) {
    return;
  }

  log.warn('Auth route mapping differs from declared auth route paths', {
    missing_paths: missingPaths.join(','),
    extra_paths: extraPaths.join(','),
    path_count: paths.length,
    handler_count: handlerKeys.length,
  });
};

export const resolveAuthHandlers = (path: string): AuthHandlers => {
  if (!isAuthRoutePath(path)) {
    throw new Error(`Unknown auth route path: ${path}`);
  }

  return authHandlerMap[path];
};

verifyAuthRouteHandlerCoverage(authRoutePaths, authHandlerMap);

/**
 * Wraps every method handler in a try/catch that guarantees a JSON response.
 *
 * When an unhandled exception escapes the handler chain, TanStack Start's
 * middleware re-throws it and the Vite dev-server error handler catches it.
 * That handler decides between JSON and HTML based on the *request*
 * Content-Type header — which is absent for GET requests. The result is an
 * HTML error page delivered to the client that expects JSON.
 *
 * This wrapper catches any such exception at the outermost boundary (before
 * TanStack Start's middleware) and always returns a well-formed JSON 500.
 */
export const wrapHandlersWithJsonErrorBoundary = (handlers: AuthHandlers): AuthHandlers => {
  const wrapped: AuthHandlers = {};
  for (const [method, handler] of Object.entries(handlers) as [string, NonNullable<AuthHandlers[keyof AuthHandlers]>][]) {
    (wrapped as Record<string, typeof handler>)[method] = async (ctx) => {
      try {
        return await handler(ctx);
      } catch (error) {
        const requestHeaders = getHeadersFromRequest(ctx.request);
        const requestId = extractRequestIdFromHeaders(requestHeaders);
        const traceId = extractTraceIdFromHeaders(requestHeaders);
        const route = new URL(ctx.request.url).pathname;
        const workspaceId = readWorkspaceIdFromRequest(ctx.request);
        const errorType = getErrorType(error);
        const errorMessage = getErrorMessage(error);

        try {
          logger.error('Unhandled exception in auth route handler', {
            method,
            route,
            workspace_id: workspaceId,
            request_id: requestId,
            trace_id: traceId,
            error_type: errorType,
            error_message: errorMessage,
          });
        } catch {
          writeLoggerFallback({
            method,
            route,
            workspaceId,
            requestId,
            traceId,
            errorType,
            errorMessage,
          });
        }

        return toJsonErrorResponse(500, 'internal_error', 'Ein unerwarteter Server-Fehler ist aufgetreten.', {
          requestId,
        });
      }
    };
  }
  return wrapped;
};

/**
 * Server-side authentication route factory
 * Creates routes with actual handler implementations from @sva/auth/server
 */
const createAuthServerRouteFactory = (path: AuthRoutePath) => {
  return (rootRoute: RootRoute) => {
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      server: {
        handlers: wrapHandlersWithJsonErrorBoundary(resolveAuthHandlers(path)),
      },
      // TanStack router types do not currently model the `server` option in this context.
      // Keep the cast local until upstream types allow full inference here.
    } as any);
  };
};

/**
 * Server-side auth route factories with handlers
 * Use these in .server.tsx files for SSR routes with auth handlers
 */
export const authServerRouteFactories = authRoutePaths.map((path) =>
  createAuthServerRouteFactory(path)
);

export { authRoutePaths } from './auth.routes';
