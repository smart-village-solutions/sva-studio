import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';

/**
 * Auth Routes - Core route definitions for authentication flow
 * 
 * These routes are framework-agnostic and can be used by any TanStack Router app.
 * Handlers are injected from @sva/auth/server at request time.
 */

const authRoutePaths = ['/auth/login', '/auth/callback', '/auth/me', '/auth/logout'] as const;

/**
 * Authentication route factory function
 * Creates a route with dynamic handler delegation for a specific auth path
 */
const createAuthRouteFactory = (path: string) => {
  return (rootRoute: RootRoute) => {
    // Create a handler that dynamically loads auth handlers on first request
    const createDynamicHandler = (handlerName: 'loginHandler' | 'callbackHandler' | 'meHandler' | 'logoutHandler') => {
      return async (ctx: any) => {
        try {
          const handlers = await import('@sva/auth/server');
          const handler = handlers[handlerName];
          if (!handler) {
            return new Response(
              JSON.stringify({ error: `Handler ${handlerName} not found` }),
              { status: 500 }
            );
          }
          // Call handler with request context if needed
          return 'request' in ctx ? handler(ctx.request) : handler();
        } catch (error) {
          console.error(`Error loading handler ${handlerName}:`, error);
          return new Response(
            JSON.stringify({ error: `Failed to load ${handlerName}` }),
            { status: 500 }
          );
        }
      };
    };

    // Map paths to handlers
    const handlerMap: Record<string, any> = {
      '/auth/login': { GET: createDynamicHandler('loginHandler') },
      '/auth/callback': { GET: createDynamicHandler('callbackHandler') },
      '/auth/me': { GET: createDynamicHandler('meHandler') },
      '/auth/logout': { POST: createDynamicHandler('logoutHandler') },
    };

    const handlers = handlerMap[path];

    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      server: import.meta.env.SSR
        ? { handlers }
        : undefined,
    });
  };
};

/**
 * Auth route factories for integration into app routers
 * These are static TanStack Router route factories that handle all auth routes
 */
export const authRouteFactories = authRoutePaths.map((path) =>
  createAuthRouteFactory(path)
);

export { authRoutePaths };
