import { createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { createRuntimeRouteTree } from './router';
import { createRouterDiagnosticsSnapshot } from './lib/router-diagnostics';

describe('createRuntimeRouteTree', () => {
  it('merges file routes with core, auth and plugin runtime routes', async () => {
    const { authRouteFactories } = await import('@sva/routing');
    const { demoRouteFactory } = await import('./routes/-demo-routes');
    const routeTree = createRuntimeRouteTree(authRouteFactories, [...(await import('./routes/-core-routes')).coreRouteFactoriesBase, demoRouteFactory]);
    const router = createRouter({
      routeTree,
      context: {
        auth: {
          getUser: async () => null,
        },
      },
      scrollRestoration: true,
      defaultPreloadStaleTime: 0,
    });
    const snapshot = createRouterDiagnosticsSnapshot({
      routeTree,
      router,
    });
    const normalizedRoutePaths = snapshot.routerRegistry.routePaths.map((path) =>
      path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path,
    );

    expect(normalizedRoutePaths).toEqual(
      expect.arrayContaining(['/', '/account', '/admin/users', '/demo', '/plugins/example', '/auth/login']),
    );
  });
});
