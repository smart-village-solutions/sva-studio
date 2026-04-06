import { createRouter } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { areDemoRoutesEnabled, createRuntimeRouteTree, readRouteGuardUser, resolveBaseUrl } from './router';
import { createRouterDiagnosticsSnapshot } from './lib/router-diagnostics';

describe('createRuntimeRouteTree', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it('reads route guard roles defensively from mixed payloads', () => {
    expect(
      readRouteGuardUser({
        user: {
          roles: ['iam_admin', 1, null, 'editor'],
        },
      }),
    ).toEqual({ roles: ['iam_admin', 'editor'] });

    expect(readRouteGuardUser({ user: { roles: 'not-an-array' } })).toEqual({ roles: [] });
  });

  it('resolves the runtime base url from window, env, and localhost fallback', () => {
    expect(resolveBaseUrl()).toBe(window.location.origin);

    const originalWindow = globalThis.window;
    const originalPublicBaseUrl = process.env.SVA_PUBLIC_BASE_URL;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });

    vi.stubEnv('SVA_PUBLIC_BASE_URL', 'https://studio.example.org');
    expect(resolveBaseUrl()).toBe('https://studio.example.org');

    vi.unstubAllEnvs();
    delete process.env.SVA_PUBLIC_BASE_URL;
    expect(resolveBaseUrl()).toBe('http://localhost:3000');

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
    if (originalPublicBaseUrl === undefined) {
      delete process.env.SVA_PUBLIC_BASE_URL;
    } else {
      process.env.SVA_PUBLIC_BASE_URL = originalPublicBaseUrl;
    }
  });

  it('enables demo routes explicitly, disables them explicitly, and defaults to enabled in the dev/test runtime', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_ROUTES', 'true');
    expect(areDemoRoutesEnabled()).toBe(true);

    vi.stubEnv('VITE_ENABLE_DEMO_ROUTES', 'false');
    expect(areDemoRoutesEnabled()).toBe(false);

    vi.unstubAllEnvs();
    expect(areDemoRoutesEnabled()).toBe(true);
  });
});
