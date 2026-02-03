import { authRouteDefinitions } from '@sva/auth/server';
import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';

import { coreRouteFactoriesBase } from './-core-routes';

const authRouteFactories = authRouteDefinitions.map(
  (definition) => (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: definition.path,
      component: () => null,
      server: {
        handlers: definition.handlers,
      },
    })
);

export const coreRouteFactories = [...coreRouteFactoriesBase, ...authRouteFactories];
