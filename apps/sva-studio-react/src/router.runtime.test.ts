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

let cookieState = '';

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
  const resolveAuthConfigForRequest = vi.fn(async () => ({ kind: 'platform' as const }));

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
    resolveAuthConfigForRequest,
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

vi.mock('@sva/auth-runtime/server', () => ({
  resolveAuthConfigForRequest: routerMocks.resolveAuthConfigForRequest,
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
    cookieState = '';
    routerMocks.executionMode.current = 'client';
    routerMocks.createRouterSpy.mockClear();
    routerMocks.fetchWithRequestTimeoutSpy.mockReset();
    routerMocks.getClientRouteFactoriesSpy.mockClear();
    routerMocks.getRequestSpy.mockClear();
    routerMocks.getRequestSpy.mockReturnValue(
      new Request('https://studio.example.org/admin/users')
    );
    routerMocks.getServerRouteFactoriesSpy.mockClear();
    routerMocks.routeFactorySpy.mockClear();
    routerMocks.resolveAuthConfigForRequest.mockClear();
    routerMocks.resolveAuthConfigForRequest.mockResolvedValue({ kind: 'platform' });
    routerMocks.rootRoute.addChildren.mockClear();
    routerMocks.parseRuntimeProfile.mockClear();
    routerMocks.isMockAuthRuntimeProfile.mockClear();
    delete (window as typeof window & { __SVA_PLAYWRIGHT_ROUTER__?: unknown })
      .__SVA_PLAYWRIGHT_ROUTER__;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookieState,
      set: (value: string) => {
        cookieState = value;
      },
    });
    document.head.querySelector('meta[name="sva-plugin-route-scope"]')?.remove();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the canonical tenant-admin mock-auth user', async () => {
    const { createMockRouteGuardUser } = await import('./router');

    expect(createMockRouteGuardUser()).toEqual({
      instanceId: 'de-musterhausen',
      assignedModules: [
        'categories',
        'cockpit-cards',
        'events',
        'media',
        'news',
        'poi',
        'waste-management',
      ],
      roles: ['system_admin'],
      permissionActions: [
        'iam.user.read',
        'iam.user.write',
        'iam.role.read',
        'iam.role.write',
        'iam.org.read',
        'iam.org.write',
        'iam.legalText.read',
        'iam.legalText.write',
        'iam.governance.read',
        'iam.governance.write',
        'iam.governance.export',
        'iam.dsr.read',
        'iam.dsr.write',
        'iam.dsr.export',
        'iam.deletionRules.read',
        'iam.deletionRules.write',
        'iam.monitoring.read',
        'iam.monitoring.write',
        'experimental.read',
        'app.read',
        'cockpit.read',
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
        'media.read',
        'media.create',
        'media.update',
        'media.reference.manage',
        'media.delete',
        'media.deliver.protected',
        'categories.read',
        'categories.create',
        'categories.update',
        'categories.delete',
        'cockpit-cards.read',
        'cockpit-cards.create',
        'cockpit-cards.update',
        'cockpit-cards.delete',
        'news.read',
        'events.read',
        'poi.read',
        'waste-management.read',
        'waste-management.master-data.manage',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
        'waste-management.import.execute',
        'waste-management.export.execute',
        'waste-management.seed.execute',
        'waste-management.reset.execute',
        'waste-management.settings.manage',
        'integration.manage',
        'feature.toggle',
      ],
    });
  });

  it('requires an active dev session and otherwise uses only explicit mock runtime profiles', async () => {
    const { isMockAuthEnabled } = await import('./router');

    vi.stubEnv('VITE_SVA_DEV_AUTH', 'true');
    expect(await isMockAuthEnabled()).toBe(false);

    vi.stubEnv('VITE_SVA_DEV_AUTH', 'false');
    vi.stubEnv('VITE_MOCK_AUTH', 'true');
    expect(await isMockAuthEnabled()).toBe(false);

    vi.stubEnv('VITE_MOCK_AUTH', 'false');
    vi.stubEnv('VITE_SVA_RUNTIME_PROFILE', 'mock-profile');
    expect(await isMockAuthEnabled()).toBe(true);
    expect(routerMocks.parseRuntimeProfile).toHaveBeenCalledWith('mock-profile');
    expect(routerMocks.isMockAuthRuntimeProfile).toHaveBeenCalledWith('mock-profile');

    vi.stubEnv('VITE_SVA_RUNTIME_PROFILE', 'default-profile');
    expect(await isMockAuthEnabled()).toBe(false);
  });

  it('builds the runtime router from routing factories and exposes the Playwright hook only for Playwright runs', async () => {
    vi.stubEnv('VITE_PLAYWRIGHT_TEST', 'true');
    const { getRouter } = await import('./router');

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
      pluginScope: 'platform',
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
    expect(
      (window as typeof window & { __SVA_PLAYWRIGHT_ROUTER__?: unknown }).__SVA_PLAYWRIGHT_ROUTER__
    ).toBe(router);
  });

  it('does not expose the Playwright hook outside Playwright runs', async () => {
    vi.stubEnv('VITE_PLAYWRIGHT_TEST', 'false');
    const { getRouter } = await import('./router');

    await getRouter();

    expect(
      (window as typeof window & { __SVA_PLAYWRIGHT_ROUTER__?: unknown }).__SVA_PLAYWRIGHT_ROUTER__
    ).toBeUndefined();
  });

  it('resolves route-guard users on the client from /auth/me and handles non-ok and failure cases', async () => {
    const { getRouter } = await import('./router');

    const router = await getRouter();
    const getUser = readRouteGuardGetUser(router);

    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            roles: ['editor', 7, 'system_admin'],
            permissionActions: ['news.read', 42, 'events.read'],
            assignedModules: ['media', 7, 'news'],
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
      permissionActions: [],
      permissionStatus: 'ok',
      assignedModules: ['media', 'news'],
    });
    expect(routerMocks.fetchWithRequestTimeoutSpy).toHaveBeenCalledWith(
      'http://localhost:3000/auth/me',
      undefined,
      { timeoutMs: 5_000 }
    );

    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );
    expect(await getUser()).toBeNull();

    routerMocks.fetchWithRequestTimeoutSpy.mockRejectedValueOnce(new Error('timeout'));
    expect(await getUser()).toBeNull();
  });

  it('loads active-organization permissions for client route guards', async () => {
    const { getRouter } = await import('./router');
    const getUser = readRouteGuardGetUser(await getRouter());

    routerMocks.fetchWithRequestTimeoutSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              instanceId: 'instance-1',
              roles: ['editor'],
              permissionActions: ['legacy.must-not-authorize'],
              assignedModules: ['news'],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { activeOrganizationId: 'org-1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ instanceId: 'instance-1', permissions: [{ action: 'news.read' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    await expect(getUser()).resolves.toEqual({
      instanceId: 'instance-1',
      roles: ['editor'],
      permissionActions: ['news.read'],
      permissionStatus: 'ok',
      assignedModules: ['news'],
    });
    expect(routerMocks.fetchWithRequestTimeoutSpy).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/v1/iam/me/context',
      { credentials: 'include' },
      { timeoutMs: 5_000 }
    );
    expect(routerMocks.fetchWithRequestTimeoutSpy).toHaveBeenNthCalledWith(
      4,
      'http://localhost:3000/iam/me/permissions?instanceId=instance-1&organizationId=org-1',
      { credentials: 'include' },
      { timeoutMs: 5_000 }
    );
  });

  it('keeps authenticated client route guards degraded when scoped access loading throws', async () => {
    const { getRouter } = await import('./router');
    const getUser = readRouteGuardGetUser(await getRouter());

    routerMocks.fetchWithRequestTimeoutSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              instanceId: 'instance-1',
              roles: ['editor'],
              permissionActions: ['legacy.must-not-authorize'],
              assignedModules: ['news'],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockRejectedValueOnce(new Error('context timeout'));

    await expect(getUser()).resolves.toEqual({
      instanceId: 'instance-1',
      roles: ['editor'],
      permissionActions: [],
      permissionStatus: 'degraded',
      assignedModules: ['news'],
    });
  });

  it('does not bypass auth-me when dev auth is only available but no dev auth cookie exists', async () => {
    const { getRouter } = await import('./router');

    vi.stubEnv('VITE_SVA_DEV_AUTH', 'true');

    const router = await getRouter();
    const getUser = readRouteGuardGetUser(router);

    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            roles: ['editor'],
            permissionActions: ['news.read'],
            assignedModules: ['news'],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    expect(await getUser()).toEqual({
      roles: ['editor'],
      permissionActions: [],
      permissionStatus: 'ok',
      assignedModules: ['news'],
    });
    expect(routerMocks.fetchWithRequestTimeoutSpy).toHaveBeenCalledWith(
      'http://localhost:3000/auth/me',
      undefined,
      { timeoutMs: 5_000 }
    );
  });

  it('resolves route-guard users on the server and falls back to null on failures', async () => {
    const { getRouter } = await import('./router');

    const router = await getRouter();
    const getUser = readRouteGuardGetUser(router);

    routerMocks.executionMode.current = 'server';
    routerMocks.fetchWithRequestTimeoutSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              instanceId: 'instance-1',
              roles: ['app_manager', 'editor'],
              permissionActions: ['legacy.must-not-authorize'],
              assignedModules: ['media'],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { activeOrganizationId: 'org-1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ instanceId: 'instance-1', permissions: [{ action: 'news.read' }] }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );
    expect(await getUser()).toEqual({
      instanceId: 'instance-1',
      roles: ['app_manager', 'editor'],
      permissionActions: ['news.read'],
      permissionStatus: 'ok',
      assignedModules: ['media'],
    });
    expect(routerMocks.getRequestSpy).toHaveBeenCalled();
    expect(routerMocks.fetchWithRequestTimeoutSpy).toHaveBeenCalledWith(
      'https://studio.example.org/auth/me',
      undefined,
      { timeoutMs: 5_000 }
    );

    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );
    expect(await getUser()).toBeNull();

    routerMocks.fetchWithRequestTimeoutSpy.mockRejectedValueOnce(new Error('auth failed'));
    expect(await getUser()).toBeNull();
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
      pluginScope: 'platform',
    });
    expect(routerMocks.routeFactorySpy).toHaveBeenCalledWith(routerMocks.rootRoute);
    expect(router).toEqual(
      expect.objectContaining({
        __router: true,
      })
    );
  });

  it('materializes tenant routes for a server-readable dev-auth session', async () => {
    vi.stubEnv('VITE_SVA_DEV_AUTH', 'true');
    routerMocks.getRequestSpy.mockReturnValueOnce({
      url: 'https://studio.example.org/plugins/waste-management',
      headers: new Headers({ cookie: 'sva_dev_auth=1' }),
    } as Request);
    const { getRouter } = await import('./router');

    routerMocks.executionMode.current = 'server';
    await getRouter();

    expect(routerMocks.resolveAuthConfigForRequest).not.toHaveBeenCalled();
    expect(routerMocks.getServerRouteFactoriesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ pluginScope: 'tenant' })
    );
  });

  it('materializes tenant routes for a client-readable dev-auth session', async () => {
    vi.stubEnv('VITE_SVA_DEV_AUTH', 'true');
    cookieState = 'sva_dev_auth=1';
    const { getRouter } = await import('./router');

    await getRouter();

    expect(routerMocks.fetchWithRequestTimeoutSpy).not.toHaveBeenCalled();
    expect(routerMocks.getClientRouteFactoriesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ pluginScope: 'tenant' })
    );
  });

  it('uses platform routes for invalid non-tenant hosts without hiding other auth failures', async () => {
    const { getRouter } = await import('./router');

    routerMocks.executionMode.current = 'server';
    routerMocks.resolveAuthConfigForRequest.mockRejectedValueOnce(
      Object.assign(new Error('invalid host'), {
        name: 'TenantAuthResolutionError',
        reason: 'tenant_host_invalid',
      })
    );

    await expect(getRouter()).resolves.toEqual(expect.objectContaining({ __router: true }));
    expect(routerMocks.getServerRouteFactoriesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ pluginScope: 'platform' })
    );

    routerMocks.resolveAuthConfigForRequest.mockRejectedValueOnce(
      Object.assign(new Error('tenant database unavailable'), {
        name: 'TenantAuthResolutionError',
        reason: 'tenant_not_found',
      })
    );

    await expect(getRouter()).rejects.toThrow('tenant database unavailable');
  });

  it('materializes only tenant plugin routes for a tenant session', async () => {
    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { instanceId: 'instance-1', roles: ['editor'] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const { getRouter } = await import('./router');

    await getRouter();

    expect(routerMocks.getClientRouteFactoriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pluginScope: 'tenant' })
    );
  });

  it('keeps the tenant plugin tree on an unauthenticated tenant host', async () => {
    routerMocks.fetchWithRequestTimeoutSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 401,
        headers: { 'X-SVA-Plugin-Route-Scope': 'tenant' },
      })
    );
    const { getRouter } = await import('./router');

    await getRouter();

    expect(routerMocks.getClientRouteFactoriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pluginScope: 'tenant' })
    );
  });

  it('keeps the server-declared tenant tree when auth me is temporarily unavailable', async () => {
    const scopeMeta = document.createElement('meta');
    scopeMeta.name = 'sva-plugin-route-scope';
    scopeMeta.content = 'tenant';
    document.head.append(scopeMeta);
    routerMocks.fetchWithRequestTimeoutSpy.mockRejectedValueOnce(new Error('network unavailable'));
    const { getRouter } = await import('./router');

    await getRouter();

    expect(routerMocks.getClientRouteFactoriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pluginScope: 'tenant' })
    );
  });
});
