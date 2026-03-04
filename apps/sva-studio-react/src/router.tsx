import { createRouter } from '@tanstack/react-router';
import { buildRouteTree, mergeRouteFactories } from '@sva/core';
import { pluginExampleRoutes } from '@sva/plugin-example';
import { authRouteFactories } from '@sva/routing';

import { rootRoute } from './routes/__root';
import { coreRouteFactoriesBase } from './routes/-core-routes';

const getAuthRouteFactories = async () => {
  if (import.meta.env.SSR) {
    const mod = await import('@sva/routing/server');
    return mod.authServerRouteFactories;
  }
  return authRouteFactories;
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
    context: {},

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
