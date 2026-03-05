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
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
};

const getRouteGuardUser = async (): Promise<RouteGuardUser | null> => {
  try {
    const response = await fetch(new URL('/auth/me', resolveBaseUrl()).toString(), {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      user?: {
        roles?: unknown;
      };
    };
    const roles = Array.isArray(payload.user?.roles)
      ? payload.user.roles.filter((entry): entry is string => typeof entry === 'string')
      : [];

    return { roles };
  } catch {
    return null;
  }
};

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
