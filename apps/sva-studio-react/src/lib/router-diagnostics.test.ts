import { describe, expect, it } from 'vitest';

import { collectRouteSnapshot, countRouteNodes, createRouterDiagnosticsSnapshot } from './router-diagnostics';

describe('router diagnostics helpers', () => {
  it('collects nested route snapshots from mixed child structures', () => {
    const snapshot = collectRouteSnapshot({
      id: '__root__',
      path: '__root__',
      fullPath: '/',
      children: {
        index: {
          id: '/',
          path: '/',
          fullPath: '/',
          children: [
            {
              id: '/demo',
              path: '/demo',
              fullPath: '/demo',
            },
          ],
        },
      },
    });

    expect(snapshot.id).toBe('__root__');
    expect(snapshot.childCount).toBe(1);
    expect(snapshot.children[0]?.fullPath).toBe('/');
    expect(snapshot.children[0]?.children[0]?.fullPath).toBe('/demo');
    expect(countRouteNodes(snapshot)).toBe(3);
  });

  it('builds a router diagnostics snapshot with registry summaries', () => {
    const snapshot = createRouterDiagnosticsSnapshot({
      routeTree: {
        id: '__root__',
        fullPath: '/',
        children: [
          {
            id: '/',
            path: '/',
            fullPath: '/',
          },
          {
            id: '/demo',
            path: '/demo',
            fullPath: '/demo',
          },
        ],
      },
      router: {
        routesById: {
          root: { id: '__root__', fullPath: '/' },
          index: { id: '/', fullPath: '/' },
          demo: { id: '/demo', fullPath: '/demo' },
        },
        routesByPath: {
          root: { id: '/', fullPath: '/' },
          demo: { id: '/demo', fullPath: '/demo' },
        },
        flatRoutes: [
          { id: '__root__', fullPath: '/' },
          { id: '/', fullPath: '/' },
          { id: '/demo', fullPath: '/demo' },
        ],
      },
    });

    expect(snapshot.routeTreeNodeCount).toBe(3);
    expect(snapshot.routerRegistry.routeIds).toEqual(['/', '/demo', '__root__']);
    expect(snapshot.routerRegistry.routePaths).toEqual(['/', '/demo']);
    expect(snapshot.routeFlags.hasRootRoute).toBe(true);
    expect(snapshot.routeFlags.hasDemoRoute).toBe(true);
  });
});
