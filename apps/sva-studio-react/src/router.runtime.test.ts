import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RouterWithAuthContext = {
  options: {
    context: {
      auth: {
        getUser: () => Promise<unknown>;
      };
    };
  };
};

const readRouteGuardGetUser = (router: unknown) => {
  return (router as RouterWithAuthContext).options.context.auth.getUser;
};

const routerMocks = vi.hoisted(() => {
  const createRouterSpy = vi.fn((options: Record<string, unknown>) => ({
    __router: true,
    options,
  }));
  const executionMode = {
    current: 'client' as 'client' | 'server',
  };
  const fetchWithRequestTimeoutSpy = vi.fn();
  const getRequestSpy = vi.fn(() => new Request('https://studio.example.org/admin/users'));
  const rootRoute = {
    addChildren: vi.fn((children: unknown[]) => ({ kind: 'route-tree', children })),
  };
  const routeFactorySpy = vi.fn(() => ({ id: 'materialized-route' }));
  const getClientRouteFactoriesSpy = vi.fn(() => [routeFactorySpy]);
  const getServerRouteFactoriesSpy = vi.fn(() => [routeFactorySpy]);
  const parseRuntimeProfile = vi.fn((value: unknown) => (typeof value === 'string' ? value : null));
  const isMockAuthRuntimeProfile = vi.fn((value: unknown) => value === 'mock-profile');

  return {
    createRouterSpy,
    executionMode,
    fetchWithRequestTimeoutSpy,
    getClientRouteFactoriesSpy,
    getRequestSpy,
    getServerRouteFactoriesSpy,
    isMockAuthRuntimeProfile,
    parseRuntimeProfile,
    rootRoute,
    routeFactorySpy,
  };
});

vi.mock('@tanstack/react-router', () => ({
  createRouter: routerMocks.createRouterSpy,
}));

vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => {
    let serverImpl: (() => unknown) | undefined;
    let clientImpl: (() => unknown) | undefined;

    const runner = (() => {
      if (routerMocks.executionMode.current === 'server') {
        return serverImpl?.();
      }

      return clientImpl?.();
    }) as {
      (): unknown;
      server: (fn: () => unknown) => typeof runner;
      client: (fn: () => unknown) => typeof runner;
    };

    runner.server = (fn) => {
      serverImpl = fn;
      return runner;
    };

    runner.client = (fn) => {
      clientImpl = fn;
      return runner;
    };

    return runner;
  },
}));

vi.mock('@sva/routing', () => ({
  getClientRouteFactories: routerMocks.getClientRouteFactoriesSpy,
}));

vi.mock('@sva/routing/server', () => ({
  getServerRouteFactories: routerMocks.getServerRouteFactoriesSpy,
}));

vi.mock('@sva/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/core')>()),
  isMockAuthRuntimeProfile: routerMocks.isMockAuthRuntimeProfile,
  parseRuntimeProfile: routerMocks.parseRuntimeProfile,
}));

vi.mock('./lib/iam-api', () => ({
  fetchWithRequestTimeout: routerMocks.fetchWithRequestTimeoutSpy,
}));

vi.mock('./routing/app-route-bindings', () => ({
  appRouteBindings: {
    home: () => null,
  },
}));

vi.mock('./lib/plugins', () => ({
  studioPlugins: [{ id: 'plugin-a' }],
  studioAdminResources: [
    {
      resourceId: 'content',
      basePath: 'content',
      titleKey: 'content.page.title',
      guard: 'content',
      views: {
        list: { bindingKey: 'content' },
        create: { bindingKey: 'contentCreate' },
        detail: { bindingKey: 'contentDetail' },
      },
    },
  ],
}));

vi.mock('./routes/__root', () => ({
  rootRoute: routerMocks.rootRoute,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: routerMocks.getRequestSpy,
}));

describe('router runtime helpers', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    routerMocks.executionMode.current = 'client';
    routerMocks.createRouterSpy.mockClear();
    routerMocks.fetchWithRequestTimeoutSpy.mockReset();
    routerMocks.getClientRouteFactoriesSpy.mockClear();
    routerMocks.getRequestSpy.mockClear();
    routerMocks.getServerRouteFactoriesSpy.mockClear();
    routerMocks.routeFactorySpy.mockClear();
    routerMocks.rootRoute.addChildren.mockClear();
    routerMocks.parseRuntimeProfile.mockClear();
    routerMocks.isMockAuthRuntimeProfile.mockClear();
    delete (window as typeof window & { __SVA_PLAYWRIGHT_ROUTER__?: unknown }).__SVA_PLAYWRIGHT_ROUTER__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the canonical privileged mock-auth roles', async () => {
    const { createMockRouteGuardUser } = await import('./router');

    expect(createMockRouteGuardUser()).toEqual({
      roles: [
        'system_admin',
        'iam_admin',
        'support_admin',
        'security_admin',
        'instance_registry_admin',
        'interface_manager',
        'app_manager',
        'editor',
      ],
      permissionActions: [
        'content.read',
        'content.create',
        'content.updateMetadata',
        'content.updatePayload',
        'content.changeStatus',
        'content.publish',
        'content.archive',
        'content.restore',
        'content.readHistory',
        'content.manageRevisions',
        'content.delete',
        'news.read',
        'events.read',
        'poi.read',
      ],
      assignedModules: ['news', 'events', 'poi'],
    });
  });

  it('enables mock auth from explicit env flags and runtime profile helpers', async () => {
    const { isMockAuthEnabled } = await import('./router');

    vi.stubEnv('VITE_MOCK_AUTH', 'true');
    expect(await isMockAuthEnabled()).toBe(true);

    vi.stubEnv('VITE_MOCK_AUTH', 'false');
    vi.stubEnv('VITE_SVA_RUNTIME_PROFILE', 'mock-profile');
    expect(await isMockAuthEnabled()).toBe(true);
    expect(routerMocks.parseRuntimeProfile).toHaveBeenCalledWith('mock-profile');
    expect(routerMocks.isMockAuthRuntimeProfile).toHaveBeenCalledWith('mock-profile');

    vi.stubEnv('VITE_SVA_RUNTIME_PROFILE', 'default-profile');
    expect(await isMockAuthEnabled()).toBe(false);
  });

  it('builds the runtime router from routing factories and exposes the Playwright hook when enabled', async () => {
    const { getRouter } = await import('./router');

    vi.stubEnv('VITE_PLAYWRIGHT_TEST', 'true');

    const router = await getRouter();

    expect(routerMocks.getClientRouteFactoriesSpy).toHaveBeenCalledWith({
      adminResources: [
        {
          resourceId: 'content',
          basePath: 'content',
          titleKey: 'content.page.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ],
      bindings: { home: expect.any(Function) },
      plugins: [{ id: 'plugin-a' }],
    });
    expect(routerMocks.routeFactorySpy).toHaveBeenCalledWith(routerMocks.rootRoute);
    expect(routerMocks.rootRoute.addChildren).toHaveBeenCalledWith([{ id: 'materialized-route' }]);
    expect(routerMocks.createRouterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        routeTree: { kind: 'route-tree', children: [{ id: 'materialized-route' }] },
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        context: {
          auth: {
            getUser: expect.any(Function),
          },
        },
      })
    );
    expect((window as typeof window & { __SVA_PLAYWRIGHT_ROUTER__?: unknown }).__SVA_PLAYWRIGHT_ROUTER__).toBe(router);
  });

  it('resolves route-guard users on the client from /auth/me and handles mock, non-ok, and failure cases', async () => {
    const { getRouter } = await import('./router');

    const router = await getRouter();
    const getUser = readRouteGuardGetUser(router);

    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            roles: ['editor', 7, 'system_admin'],
            permissionActions: ['news.read', 42, 'events.read'],
            assignedModules: ['news', false, 'events'],
          },
        }),
        {
        status: 200,
        headers: { 'content-type': 'application/json' },
        }
      )
    );
    expect(await getUser()).toEqual({
      roles: ['editor', 'system_admin'],
      permissionActions: ['news.read', 'events.read'],
      assignedModules: ['news', 'events'],
      permissionStatus: 'ok',
    });
    expect(routerMocks.fetchWithRequestTimeoutSpy).toHaveBeenCalledWith(
      'http://localhost:3000/auth/me',
      undefined,
      { timeoutMs: 5_000 }
    );

    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await getUser()).toBeNull();

    routerMocks.fetchWithRequestTimeoutSpy.mockRejectedValueOnce(new Error('timeout'));
    expect(await getUser()).toBeNull();

    vi.stubEnv('VITE_MOCK_AUTH', 'true');
    expect(await getUser()).toEqual({
      roles: [
        'system_admin',
        'iam_admin',
        'support_admin',
        'security_admin',
        'instance_registry_admin',
        'interface_manager',
        'app_manager',
        'editor',
      ],
      permissionActions: [
        'content.read',
        'content.create',
        'content.updateMetadata',
        'content.updatePayload',
        'content.changeStatus',
        'content.publish',
        'content.archive',
        'content.restore',
        'content.readHistory',
        'content.manageRevisions',
        'content.delete',
        'news.read',
        'events.read',
        'poi.read',
      ],
      assignedModules: ['news', 'events', 'poi'],
    });
  });

  it('resolves route-guard users on the server and falls back to null on failures', async () => {
    const { getRouter } = await import('./router');

    const router = await getRouter();
    const getUser = readRouteGuardGetUser(router);

    routerMocks.executionMode.current = 'server';
    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ user: { roles: ['app_manager', 'editor'], permissionActions: ['news.read'] } }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );
    expect(await getUser()).toEqual({
      roles: ['app_manager', 'editor'],
      permissionActions: ['news.read'],
      assignedModules: [],
      permissionStatus: 'ok',
    });
    expect(routerMocks.getRequestSpy).toHaveBeenCalled();
    expect(routerMocks.fetchWithRequestTimeoutSpy).toHaveBeenCalledWith(
      'https://studio.example.org/auth/me',
      undefined,
      { timeoutMs: 5_000 }
    );

    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await getUser()).toBeNull();

    routerMocks.fetchWithRequestTimeoutSpy.mockRejectedValueOnce(new Error('auth failed'));
    expect(await getUser()).toBeNull();

    vi.stubEnv('VITE_MOCK_AUTH', 'true');
    expect(await getUser()).toEqual({
      roles: [
        'system_admin',
        'iam_admin',
        'support_admin',
        'security_admin',
        'instance_registry_admin',
        'interface_manager',
        'app_manager',
        'editor',
      ],
      permissionActions: [
        'content.read',
        'content.create',
        'content.updateMetadata',
        'content.updatePayload',
        'content.changeStatus',
        'content.publish',
        'content.archive',
        'content.restore',
        'content.readHistory',
        'content.manageRevisions',
        'content.delete',
        'news.read',
        'events.read',
        'poi.read',
      ],
      assignedModules: ['news', 'events', 'poi'],
    });
  });

  it('builds the runtime router from server route factories when executed on the server', async () => {
    const { getRouter } = await import('./router');

    routerMocks.executionMode.current = 'server';

    const router = await getRouter();

    expect(routerMocks.getServerRouteFactoriesSpy).toHaveBeenCalledWith({
      adminResources: [
        {
          resourceId: 'content',
          basePath: 'content',
          titleKey: 'content.page.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ],
      bindings: { home: expect.any(Function) },
      plugins: [{ id: 'plugin-a' }],
    });
    expect(routerMocks.routeFactorySpy).toHaveBeenCalledWith(routerMocks.rootRoute);
    expect(router).toEqual(
      expect.objectContaining({
        __router: true,
      })
    );
  });
});
