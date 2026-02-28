import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';
import { authRoutePaths } from './auth.routes';

type AuthHandlers = {
  GET?: (ctx: { request: Request }) => Promise<Response> | Response;
  POST?: (ctx: { request: Request }) => Promise<Response> | Response;
};

const resolveAuthHandlers = (path: typeof authRoutePaths[number]): AuthHandlers => {
  if (path === '/auth/login') {
    return {
      GET: async () => {
        const mod = await import('@sva/auth/server');
        return mod.loginHandler();
      },
    };
  }

  if (path === '/auth/callback') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.callbackHandler(request);
      },
    };
  }

  if (path === '/auth/me') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.meHandler(request);
      },
    };
  }

  if (path === '/iam/me/permissions') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.mePermissionsHandler(request);
      },
    };
  }

  if (path === '/iam/authorize') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.authorizeHandler(request);
      },
    };
  }

  if (path === '/iam/governance/workflows') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.governanceWorkflowHandler(request);
      },
    };
  }

  if (path === '/iam/governance/compliance/export') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.governanceComplianceExportHandler(request);
      },
    };
  }

  if (path === '/iam/me/data-export') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.dataExportHandler(request);
      },
    };
  }

  if (path === '/iam/me/data-export/status') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.dataExportStatusHandler(request);
      },
    };
  }

  if (path === '/iam/me/data-subject-rights/requests') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.dataSubjectRequestHandler(request);
      },
    };
  }

  if (path === '/iam/me/profile') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.profileCorrectionHandler(request);
      },
    };
  }

  if (path === '/iam/me/optional-processing/execute') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.optionalProcessingExecuteHandler(request);
      },
    };
  }

  if (path === '/iam/admin/data-subject-rights/export') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.adminDataExportHandler(request);
      },
    };
  }

  if (path === '/iam/admin/data-subject-rights/export/status') {
    return {
      GET: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.adminDataExportStatusHandler(request);
      },
    };
  }

  if (path === '/iam/admin/data-subject-rights/legal-holds/apply') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.legalHoldApplyHandler(request);
      },
    };
  }

  if (path === '/iam/admin/data-subject-rights/legal-holds/release') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.legalHoldReleaseHandler(request);
      },
    };
  }

  if (path === '/iam/admin/data-subject-rights/maintenance') {
    return {
      POST: async ({ request }) => {
        const mod = await import('@sva/auth/server');
        return mod.dataSubjectMaintenanceHandler(request);
      },
    };
  }

  return {
    POST: async ({ request }) => {
      const mod = await import('@sva/auth/server');
      return mod.logoutHandler(request);
    },
  };
};

/**
 * Server-side authentication route factory
 * Creates routes with actual handler implementations from @sva/auth/server
 */
const createAuthServerRouteFactory = (path: typeof authRoutePaths[number]) => {
  return (rootRoute: RootRoute) => {
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      server: {
        handlers: resolveAuthHandlers(path),
      },
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

export { authRoutePaths };
