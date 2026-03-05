import { createRouter } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { buildRouteTree, mergeRouteFactories } from '@sva/core';
import { pluginExampleRoutes } from '@sva/plugin-example';
import type { RouteGuardUser } from '@sva/routing';

import { rootRoute } from './routes/__root';
import { coreRouteFactoriesBase } from './routes/-core-routes';

const getAuthRouteFactories = createIsomorphicFn()
  .server(async () => {
    const mod = await import('@sva/routing/server');
    return mod.authServerRouteFactories;
  })
  .client(async () => {
    const mod = await import('@sva/routing');
    return mod.authRouteFactories;
  });

const resolveBaseUrl = () => {
  if (typeof globalThis.window !== 'undefined') {
    return globalThis.window.location.origin;
  }
  return process.env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
};

const readRouteGuardUser = (payload: unknown): RouteGuardUser => {
  const parsedPayload = payload as {
    user?: {
      roles?: unknown;
    };
  };

  const roles = Array.isArray(parsedPayload.user?.roles)
    ? parsedPayload.user.roles.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return { roles };
};

const getRouteGuardUser = createIsomorphicFn()
  .server(async (): Promise<RouteGuardUser | null> => {
    try {
      const { getRequest, getRequestHeader } = await import('@tanstack/react-start/server');

      const request = getRequest();
      const cookieHeader = getRequestHeader('cookie');
      if (!cookieHeader) {
        return null;
      }

      const response = await fetch(new URL('/auth/me', request.url).toString(), {
        headers: {
          cookie: cookieHeader,
        },
      });

      if (!response.ok) {
        return null;
      }

      return readRouteGuardUser(await response.json());
    } catch {
      return null;
    }
  })
  .client(async (): Promise<RouteGuardUser | null> => {
    try {
      const response = await fetch(new URL('/auth/me', resolveBaseUrl()).toString(), {
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      return readRouteGuardUser(await response.json());
    } catch {
      return null;
    }
  });

// Create a new router instance
export const getRouter = async () => {
  const runtimeAuthRouteFactories = await getAuthRouteFactories();
  const routeTree = buildRouteTree(
    rootRoute,
    mergeRouteFactories([...coreRouteFactoriesBase, ...runtimeAuthRouteFactories], pluginExampleRoutes)
  );

  const router = createRouter({
    routeTree,
    context: {
      auth: {
        getUser: getRouteGuardUser,
      },
    },

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
