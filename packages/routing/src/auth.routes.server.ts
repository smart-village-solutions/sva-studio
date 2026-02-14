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
    });
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
