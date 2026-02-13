import { createRouter } from '@tanstack/react-router';
import { buildRouteTree, mergeRouteFactories } from '@sva/core';
import { pluginExampleRoutes } from '@sva/plugin-example';

import { rootRoute } from './routes/__root';
import { coreRouteFactories as clientCoreRouteFactories } from './routes/-core-routes';

const getCoreRouteFactories = async () => {
  if (import.meta.env.SSR) {
    const mod = await import('./routes/-core-routes.server');
    return mod.coreRouteFactories;
  }
  return clientCoreRouteFactories;
};

// Create a new router instance
export const getRouter = async () => {
  const coreRouteFactories = await getCoreRouteFactories();
  const routeTree = buildRouteTree(
    rootRoute,
    mergeRouteFactories(coreRouteFactories, pluginExampleRoutes)
  );

  const router = createRouter({
    routeTree,
    context: {},

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
