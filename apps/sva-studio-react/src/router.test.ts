import { createRouter } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createRuntimeRouteTree,
  readRouteGuardUser,
  resolveBaseUrl,
} from './router';
import { createRouterDiagnosticsSnapshot } from './lib/router-diagnostics';
import { appRouteBindings } from './routing/app-route-bindings';
import { studioAdminResources, studioPlugins } from './lib/plugins';

describe('createRuntimeRouteTree', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the route tree solely from @sva/routing and the root route', async () => {
    const { getClientRouteFactories } = await import('@sva/routing');
    const routeTree = createRuntimeRouteTree(
      getClientRouteFactories({ bindings: appRouteBindings, adminResources: studioAdminResources, plugins: studioPlugins })
    );
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
      expect.arrayContaining([
        '/',
        '/account',
        '/admin/users',
        '/admin/content',
        '/content',
        '/admin/news',
        '/admin/news/new',
        '/admin/news/$id',
        '/auth/login',
      ]),
    );
  });

  it('reads route guard roles defensively from mixed payloads', () => {
    expect(
      readRouteGuardUser({
        user: {
          roles: ['iam_admin', 1, null, 'editor'],
          permissionActions: ['news.read', false, 'events.read'],
          assignedModules: ['news', null, 'events'],
        },
      }),
    ).toEqual({
      roles: ['iam_admin', 'editor'],
      permissionActions: ['news.read', 'events.read'],
      assignedModules: ['news', 'events'],
      permissionStatus: 'ok',
    });

    expect(readRouteGuardUser({ user: { roles: 'not-an-array' } })).toEqual({
      roles: [],
      permissionActions: [],
      assignedModules: [],
      permissionStatus: 'ok',
    });
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

});
