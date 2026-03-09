import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';
import { authRoutePaths } from './auth.routes';

type AuthHandlers = {
  GET?: (ctx: { request: Request }) => Promise<Response> | Response;
  POST?: (ctx: { request: Request }) => Promise<Response> | Response;
  PUT?: (ctx: { request: Request }) => Promise<Response> | Response;
  PATCH?: (ctx: { request: Request }) => Promise<Response> | Response;
  DELETE?: (ctx: { request: Request }) => Promise<Response> | Response;
};

type AuthRoutePath = (typeof authRoutePaths)[number];

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
  '/api/v1/iam/admin/reconcile': {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.reconcileHandler(request);
    },
  },
  '/iam/governance/workflows': {
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

export const resolveAuthHandlers = (path: string): AuthHandlers => {
  if (!isAuthRoutePath(path)) {
    throw new Error(`Unknown auth route path: ${path}`);
  }

  return authHandlerMap[path];
};

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
        // Log here so the real cause is visible in the server terminal.
        console.error(
          `[auth-route] Unhandled exception in ${method} handler (route will return JSON 500):`,
          error,
        );
        return new Response(
          JSON.stringify({
            error: {
              code: 'internal_error',
              message: 'Ein unerwarteter Server-Fehler ist aufgetreten.',
            },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
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
