import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserRoutingLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const guardSpies = vi.hoisted(() => ({
  account: vi.fn(async () => undefined),
  accountPrivacy: vi.fn(async () => undefined),
  content: vi.fn(async () => undefined),
  contentCreate: vi.fn(async () => undefined),
  contentDetail: vi.fn(async () => undefined),
  adminUsers: vi.fn(async () => undefined),
  adminUserCreate: vi.fn(async () => undefined),
  adminUserDetail: vi.fn(async () => undefined),
  adminOrganizations: vi.fn(async () => undefined),
  adminOrganizationCreate: vi.fn(async () => undefined),
  adminOrganizationDetail: vi.fn(async () => undefined),
  adminInstances: vi.fn(async () => undefined),
  adminRoles: vi.fn(async () => undefined),
  adminRoleDetail: vi.fn(async () => undefined),
  adminGroups: vi.fn(async () => undefined),
  adminGroupCreate: vi.fn(async () => undefined),
  adminGroupDetail: vi.fn(async () => undefined),
  adminLegalTexts: vi.fn(async () => undefined),
  adminLegalTextCreate: vi.fn(async () => undefined),
  adminLegalTextDetail: vi.fn(async () => undefined),
  adminIam: vi.fn(async () => undefined),
}));

const createAccountUiRouteGuardMock = vi.hoisted(() =>
  vi.fn((guardKey: keyof typeof guardSpies) => guardSpies[guardKey])
);

const createRouteMock = vi.hoisted(() =>
  vi.fn((options: Record<string, unknown>) => ({
    options,
    useSearch: () =>
      typeof options.validateSearch === 'function'
        ? (options.validateSearch as (search: Record<string, unknown>) => unknown)({ tab: 'bogus' })
        : {},
  }))
);

vi.mock('@tanstack/react-router', () => ({
  createRoute: createRouteMock,
}));

vi.mock('@sva/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/sdk')>('@sva/sdk');

  return {
    ...actual,
    createBrowserLogger: () => browserRoutingLogger,
  };
});

vi.mock('./account-ui.routes', () => ({
  accountUiRouteGuards: guardSpies,
  createAccountUiRouteGuards: vi.fn(() => guardSpies),
  createAccountUiRouteGuard: createAccountUiRouteGuardMock,
}));

import {
  getClientRouteFactories,
  getPluginRouteFactories,
  mapPluginGuardToAccountGuard,
} from './app.routes';
import { getServerRouteFactories } from './app.routes.server';
import { normalizeIamTab, normalizeRoleDetailTab } from './route-search';

type RouteOptionsUnderTest = {
  path?: string;
  getParentRoute?: () => unknown;
  beforeLoad?: (options: unknown) => Promise<void> | void;
  validateSearch?: (search: Record<string, unknown>) => unknown;
  component?: () => unknown;
};

const bindingKeys = [
  'home',
  'account',
  'accountPrivacy',
  'content',
  'contentCreate',
  'contentDetail',
  'media',
  'categories',
  'app',
  'interfaces',
  'help',
  'support',
  'license',
  'adminUsers',
  'adminUserCreate',
  'adminUserDetail',
  'adminOrganizations',
  'adminOrganizationCreate',
  'adminOrganizationDetail',
  'adminInstances',
  'adminInstanceCreate',
  'adminInstanceDetail',
  'adminRoles',
  'adminRoleCreate',
  'adminRoleDetail',
  'adminGroups',
  'adminGroupCreate',
  'adminGroupDetail',
  'adminLegalTexts',
  'adminLegalTextCreate',
  'adminLegalTextDetail',
  'adminIam',
  'modules',
  'monitoring',
  'adminApiPhase1Test',
] as const;

const bindings = Object.fromEntries(
  bindingKeys.map((key) => [key, () => key])
);

const readRouteOptions = (route: unknown): RouteOptionsUnderTest => {
  return (route as { options: unknown }).options as RouteOptionsUnderTest;
};

describe('app.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds client route factories from the canonical UI definitions and plugin definitions', async () => {
    const newsPlugin = {
      id: 'news',
      displayName: 'News',
      routes: [
        {
          id: 'news.list',
          path: '/plugins/news',
          guard: 'content.read' as const,
          component: () => 'news',
        },
      ],
    };
    const pluginFactories = getPluginRouteFactories([newsPlugin]);
    const routeFactories = getClientRouteFactories({
      bindings,
      plugins: [
        newsPlugin,
        {
          id: 'example',
          displayName: 'Example',
          routes: [
            {
              id: 'example.list',
              path: '/plugins/example',
              component: () => 'example',
            },
          ],
        },
      ],
    });
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(routeMap.has('/')).toBe(true);
    expect(routeMap.has('/content')).toBe(true);
    expect(routeMap.has('/admin/users')).toBe(true);
    expect(routeMap.has('/admin/roles/$roleId')).toBe(true);
    expect(routeMap.has('/auth/login')).toBe(true);
    expect(routeMap.has('/plugins/example')).toBe(true);
    expect(pluginFactories).toHaveLength(1);
    expect(readRouteOptions(routeMap.get('/account')).getParentRoute?.()).toBe(rootRoute);

    await readRouteOptions(routeMap.get('/account')).beforeLoad?.({ href: '/account' });
    await readRouteOptions(routeMap.get('/admin/users')).beforeLoad?.({ href: '/admin/users' });
    await readRouteOptions(routeMap.get('/plugins/example')).beforeLoad?.({ href: '/plugins/example' });
    await readRouteOptions(routeMap.get('/plugins/news')).beforeLoad?.({ href: '/plugins/news' });

    expect(guardSpies.account).toHaveBeenCalledWith({ href: '/account' });
    expect(guardSpies.adminUsers).toHaveBeenCalledWith({ href: '/admin/users' });
    expect(guardSpies.content).toHaveBeenCalledWith({ href: '/plugins/news' });
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('account', expect.any(Function), '/account');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('adminUsers', expect.any(Function), '/admin/users');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('content', expect.any(Function), '/plugins/news');

    expect(readRouteOptions(routeMap.get('/admin/iam')).validateSearch?.({ tab: 'bogus' })).toEqual({
      tab: 'rights',
    });
    expect(readRouteOptions(routeMap.get('/admin/roles/$roleId')).validateSearch?.({ tab: 'bogus' })).toEqual({
      tab: 'general',
    });
  });

  it('keeps unguarded UI routes and unguarded plugin routes callable without account guard execution', async () => {
    const routeFactories = getClientRouteFactories({
      bindings,
      plugins: [
        {
          id: 'public-plugin',
          displayName: 'Public plugin',
          routes: [
            {
              id: 'public-plugin.list',
              path: '/plugins/public',
              component: () => 'public',
            },
          ],
        },
      ],
    });
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    const guardCallCount = Object.values(guardSpies).reduce((count, spy) => count + spy.mock.calls.length, 0);

    expect(readRouteOptions(routeMap.get('/interfaces')).getParentRoute?.()).toBe(rootRoute);
    expect(readRouteOptions(routeMap.get('/interfaces')).beforeLoad).toBeUndefined();
    expect(readRouteOptions(routeMap.get('/help')).beforeLoad).toBeUndefined();
    expect(readRouteOptions(routeMap.get('/admin/api/phase1-test')).beforeLoad).toBeUndefined();

    expect(await readRouteOptions(routeMap.get('/plugins/public')).beforeLoad?.({ href: '/plugins/public' })).toBeUndefined();

    const nextGuardCallCount = Object.values(guardSpies).reduce((count, spy) => count + spy.mock.calls.length, 0);
    expect(nextGuardCallCount).toBe(guardCallCount);
  });

  it('routes plugin guards to the canonical account-ui guards during beforeLoad', async () => {
    const routeFactories = getClientRouteFactories({
      bindings,
      plugins: [
        {
          id: 'plugin-guards',
          displayName: 'Plugin guards',
          routes: [
            {
              id: 'plugin.read',
              path: '/plugins/read',
              guard: 'content.read',
              component: () => 'read',
            },
            {
              id: 'plugin.create',
              path: '/plugins/create',
              guard: 'content.create',
              component: () => 'create',
            },
            {
              id: 'plugin.write',
              path: '/plugins/write',
              guard: 'content.write',
              component: () => 'write',
            },
          ],
        },
      ],
    });
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(readRouteOptions(routeMap.get('/plugins/read')).getParentRoute?.()).toBe(rootRoute);
    await readRouteOptions(routeMap.get('/plugins/read')).beforeLoad?.({ href: '/plugins/read' });
    await readRouteOptions(routeMap.get('/plugins/create')).beforeLoad?.({ href: '/plugins/create' });
    await readRouteOptions(routeMap.get('/plugins/write')).beforeLoad?.({ href: '/plugins/write' });

    expect(guardSpies.content).toHaveBeenCalledWith({ href: '/plugins/read' });
    expect(guardSpies.contentCreate).toHaveBeenCalledWith({ href: '/plugins/create' });
    expect(guardSpies.contentDetail).toHaveBeenCalledWith({ href: '/plugins/write' });
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('content', expect.any(Function), '/plugins/read');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('contentCreate', expect.any(Function), '/plugins/create');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('contentDetail', expect.any(Function), '/plugins/write');
  });

  it('emits one diagnostics event for unsupported plugin guards when the route is matched', async () => {
    const diagnostics = vi.fn();

    const pluginFactories = getPluginRouteFactories(
      [
        {
          id: 'plugin-unsupported',
          displayName: 'Plugin unsupported',
          routes: [
            {
              id: 'plugin.unsupported',
              path: '/plugins/unsupported',
              guard: 'unknown.guard' as never,
              component: () => 'unsupported',
            },
          ],
        },
      ],
      { diagnostics }
    );
    const route = pluginFactories[0]?.({ id: 'root' } as never);

    expect(pluginFactories).toHaveLength(1);
    expect(diagnostics).not.toHaveBeenCalled();

    await readRouteOptions(route).beforeLoad?.({ href: '/plugins/unsupported' });

    expect(diagnostics).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledWith({
      level: 'warn',
      event: 'routing.plugin.guard_unsupported',
      route: '/plugins/unsupported',
      reason: 'unsupported-plugin-guard',
      plugin: 'plugin-unsupported',
      unsupported_guard: 'unknown.guard',
    });
  });

  it('logs unsupported plugin guards through the default diagnostics logger when the route is matched', async () => {
    const pluginFactories = getPluginRouteFactories([
      {
        id: 'default-logged-plugin',
        displayName: 'Default logged plugin',
        routes: [
          {
            id: 'default.logged',
            path: '/plugins/default-logged',
            guard: 'unsupported.guard' as never,
            component: () => 'unsupported',
          },
        ],
      },
    ]);
    const route = pluginFactories[0]?.({ id: 'root' } as never);

    expect(pluginFactories).toHaveLength(1);
    expect(browserRoutingLogger.warn).not.toHaveBeenCalled();

    await readRouteOptions(route).beforeLoad?.({ href: '/plugins/default-logged' });

    expect(browserRoutingLogger.warn).toHaveBeenCalledWith(
      'Unsupported plugin route guard',
      expect.objectContaining({
        event: 'routing.plugin.guard_unsupported',
        route: '/plugins/default-logged',
        plugin: 'default-logged-plugin',
        unsupported_guard: 'unsupported.guard',
      })
    );
  });

  it('builds server route factories without requiring app-local route composition', () => {
    const routeFactories = getServerRouteFactories({ bindings, diagnostics: vi.fn() });

    expect(routeFactories.some((factory) => readRouteOptions(factory({ id: 'root' } as never)).path === '/auth/login')).toBe(true);
    expect(routeFactories.some((factory) => readRouteOptions(factory({ id: 'root' } as never)).path === '/account')).toBe(true);
  });

  it('maps plugin guards onto canonical account-ui guards', () => {
    expect(mapPluginGuardToAccountGuard('content.read')).toBe('content');
    expect(mapPluginGuardToAccountGuard('content.create')).toBe('contentCreate');
    expect(mapPluginGuardToAccountGuard('content.write')).toBe('contentDetail');
    expect(mapPluginGuardToAccountGuard(undefined)).toBeNull();
  });

  it('normalizes IAM and role detail tabs to canonical search values', () => {
    expect(normalizeIamTab('governance')).toBe('governance');
    expect(normalizeIamTab('dsr')).toBe('dsr');
    expect(normalizeIamTab('anything-else')).toBe('rights');

    expect(normalizeRoleDetailTab('permissions')).toBe('permissions');
    expect(normalizeRoleDetailTab('assignments')).toBe('assignments');
    expect(normalizeRoleDetailTab('sync')).toBe('sync');
    expect(normalizeRoleDetailTab('anything-else')).toBe('general');
  });

  it('threads diagnostics through the client route factory entry points', () => {
    const diagnostics = vi.fn();

    const routeFactories = getClientRouteFactories({
      bindings,
      plugins: [
        {
          id: 'client-unsupported',
          displayName: 'Client unsupported',
          routes: [
            {
              id: 'client.unsupported',
              path: '/plugins/client-unsupported',
              guard: 'unsupported.guard' as never,
              component: () => 'unsupported',
            },
          ],
        },
      ],
      diagnostics,
    });

    expect(routeFactories.length).toBeGreaterThan(0);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'routing.plugin.guard_unsupported',
        plugin: 'client-unsupported',
      })
    );
  });

  it('threads a default diagnostics hook through the server route factory entry point', () => {
    getServerRouteFactories({ bindings });

    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('account', expect.any(Function), '/account');
  });
});
