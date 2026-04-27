import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const redirectMock = vi.hoisted(() => vi.fn((options: Record<string, unknown>) => ({ ...options, __redirect: true })));

vi.mock('@tanstack/react-router', () => ({
  createRoute: createRouteMock,
  redirect: redirectMock,
}));

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
import { createUiRouteFactories, getAdminDetailRoutePath } from './app.routes.shared';
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

const adminResources = [
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
] as const;

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
      adminResources,
      plugins: [
        newsPlugin,
        {
          id: 'calendar',
          displayName: 'Calendar',
          routes: [
            {
              id: 'calendar.list',
              path: '/plugins/calendar',
              component: () => 'calendar',
            },
          ],
        },
      ],
    });
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(routeMap.has('/')).toBe(true);
    expect(routeMap.has('/admin/content')).toBe(true);
    expect(routeMap.has('/content')).toBe(true);
    expect(routeMap.has('/admin/users')).toBe(true);
    expect(routeMap.has('/admin/roles/$roleId')).toBe(true);
    expect(routeMap.has('/modules')).toBe(true);
    expect(routeMap.has('/monitoring')).toBe(true);
    expect(routeMap.has('/auth/login')).toBe(true);
    expect(routeMap.has('/plugins/calendar')).toBe(true);
    expect(pluginFactories).toHaveLength(1);
    expect(readRouteOptions(routeMap.get('/account')).getParentRoute?.()).toBe(rootRoute);

    await readRouteOptions(routeMap.get('/account')).beforeLoad?.({ href: '/account' });
    await readRouteOptions(routeMap.get('/admin/users')).beforeLoad?.({ href: '/admin/users' });
    await readRouteOptions(routeMap.get('/modules')).beforeLoad?.({ href: '/modules' });
    await readRouteOptions(routeMap.get('/monitoring')).beforeLoad?.({ href: '/monitoring' });
    await readRouteOptions(routeMap.get('/plugins/calendar')).beforeLoad?.({ href: '/plugins/calendar' });
    await readRouteOptions(routeMap.get('/plugins/news')).beforeLoad?.({ href: '/plugins/news' });

    expect(guardSpies.account).toHaveBeenCalledWith({ href: '/account' });
    expect(guardSpies.adminUsers).toHaveBeenCalledWith({ href: '/admin/users' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/modules' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/monitoring' });
    expect(guardSpies.content).toHaveBeenCalledWith({ href: '/plugins/news' });
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('account', undefined, '/account');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('content', undefined, '/admin/content');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('adminUsers', undefined, '/admin/users');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('adminRoles', undefined, '/modules');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('adminRoles', undefined, '/monitoring');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('content', undefined, '/plugins/news');

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
      adminResources,
      plugins: [
        {
          id: 'public-plugin',
          displayName: 'Public plugin',
          routes: [
            {
              id: 'public-plugin.list',
              path: '/plugins/public-plugin',
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

    expect(await readRouteOptions(routeMap.get('/plugins/public-plugin')).beforeLoad?.({ href: '/plugins/public-plugin' })).toBeUndefined();

    const nextGuardCallCount = Object.values(guardSpies).reduce((count, spy) => count + spy.mock.calls.length, 0);
    expect(nextGuardCallCount).toBe(guardCallCount);
  });

  it('routes plugin guards to the canonical account-ui guards during beforeLoad', async () => {
    const routeFactories = getClientRouteFactories({
      bindings,
      adminResources,
      plugins: [
        {
          id: 'plugin-guards',
          displayName: 'Plugin guards',
          routes: [
            {
              id: 'plugin.read',
              path: '/plugins/plugin-guards/read',
              guard: 'content.read',
              component: () => 'read',
            },
            {
              id: 'plugin.create',
              path: '/plugins/plugin-guards/create',
              guard: 'content.create',
              component: () => 'create',
            },
            {
              id: 'plugin.write',
              path: '/plugins/plugin-guards/write',
              guard: 'content.updatePayload',
              component: () => 'write',
            },
          ],
        },
      ],
    });
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(readRouteOptions(routeMap.get('/plugins/plugin-guards/read')).getParentRoute?.()).toBe(rootRoute);
    await readRouteOptions(routeMap.get('/plugins/plugin-guards/read')).beforeLoad?.({ href: '/plugins/plugin-guards/read' });
    await readRouteOptions(routeMap.get('/plugins/plugin-guards/create')).beforeLoad?.({ href: '/plugins/plugin-guards/create' });
    await readRouteOptions(routeMap.get('/plugins/plugin-guards/write')).beforeLoad?.({ href: '/plugins/plugin-guards/write' });

    expect(guardSpies.content).toHaveBeenCalledWith({ href: '/plugins/plugin-guards/read' });
    expect(guardSpies.contentCreate).toHaveBeenCalledWith({ href: '/plugins/plugin-guards/create' });
    expect(guardSpies.contentDetail).toHaveBeenCalledWith({ href: '/plugins/plugin-guards/write' });
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('content', undefined, '/plugins/plugin-guards/read');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('contentCreate', undefined, '/plugins/plugin-guards/create');
    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('contentDetail', undefined, '/plugins/plugin-guards/write');
  });

  it('redirects legacy content aliases to the canonical admin content routes', () => {
    const routeFactories = getClientRouteFactories({
      bindings,
      adminResources,
    });
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(() => readRouteOptions(routeMap.get('/content')).beforeLoad?.({ href: '/content?page=2' })).toThrow(
      expect.objectContaining({ href: '/admin/content?page=2', __redirect: true })
    );
    expect(() => readRouteOptions(routeMap.get('/content/new')).beforeLoad?.({ href: '/content/new' })).toThrow(
      expect.objectContaining({ href: '/admin/content/new', __redirect: true })
    );
    expect(
      () => readRouteOptions(routeMap.get('/content/$contentId')).beforeLoad?.({ href: '/content/content-7' })
    ).toThrow(expect.objectContaining({ href: '/admin/content/content-7', __redirect: true }));
  });

  it('keeps core content routes available when no admin resources are injected', () => {
    const routeFactories = getClientRouteFactories({
      bindings,
    });
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(routeMap.has('/admin/content')).toBe(true);
    expect(routeMap.has('/admin/content/new')).toBe(true);
    expect(routeMap.has('/admin/content/$id')).toBe(true);
  });

  it('defaults admin resources to an empty list when ui route factories are created without options', () => {
    const routeFactories = createUiRouteFactories(bindings);
    const rootRoute = { id: 'root' };
    const routeMap = new Map(
      routeFactories.map((factory) => {
        const route = factory(rootRoute as never);
        return [String(readRouteOptions(route).path), route];
      })
    );

    expect(routeMap.has('/admin/content')).toBe(true);
    expect(routeMap.has('/admin/content/new')).toBe(true);
    expect(routeMap.has('/admin/content/$id')).toBe(true);
  });

  it('falls back to the generic id detail param for unmapped admin detail bindings', () => {
    expect(getAdminDetailRoutePath('/admin/custom', 'help')).toBe('/admin/custom/$id');
  });

  it('fails fast when injected admin resources shadow built-in admin routes', () => {
    expect(() =>
      getClientRouteFactories({
        bindings,
        adminResources: [
          ...adminResources,
          {
            resourceId: 'plugin.users',
            basePath: 'users',
            titleKey: 'plugin.users.title',
            guard: 'adminUsers',
            views: {
              list: { bindingKey: 'adminUsers' },
              create: { bindingKey: 'adminUserCreate' },
              detail: { bindingKey: 'adminUserDetail' },
            },
          },
        ],
      })
    ).toThrow('admin_resource_static_route_conflict:plugin.users:/admin/users');
  });

  it('fails fast when injected admin resources contain duplicate base paths', () => {
    expect(() =>
      createUiRouteFactories(bindings, {
        adminResources: [
          ...adminResources,
          {
            resourceId: 'news.content',
            basePath: 'content',
            titleKey: 'news.content.title',
            guard: 'content',
            views: {
              list: { bindingKey: 'content' },
              create: { bindingKey: 'contentCreate' },
              detail: { bindingKey: 'contentDetail' },
            },
          },
        ],
      })
    ).toThrow('admin_resource_base_path_conflict:content:news.content:content');
  });

  it('fails fast for unsupported plugin guards during factory creation', () => {
    const diagnostics = vi.fn();

    expect(() =>
      getPluginRouteFactories(
      [
        {
          id: 'plugin-unsupported',
          displayName: 'Plugin unsupported',
          routes: [
            {
              id: 'plugin.unsupported',
              path: '/plugins/plugin-unsupported',
              guard: 'unknown.guard' as never,
              component: () => 'unsupported',
            },
          ],
        },
      ],
      { diagnostics }
      )
    ).toThrow('plugin_guardrail_unsupported_binding:plugin-unsupported:plugin.unsupported:guard');
    expect(diagnostics).not.toHaveBeenCalled();
  });

  it('fails fast for non-canonical plugin route paths', () => {
    expect(() =>
      getPluginRouteFactories([
        {
          id: 'default-logged-plugin',
          displayName: 'Default logged plugin',
          routes: [
            {
              id: 'default.logged',
              path: '/plugins/default-logged',
              guard: 'content.read',
              component: () => 'default',
            },
          ],
        },
      ])
    ).toThrow('plugin_guardrail_route_bypass:default-logged-plugin:default.logged:path');
  });

  it('materializes registered plugin permission guards as protected routes', async () => {
    const routeFactories = getPluginRouteFactories([
      {
        id: 'news',
        displayName: 'News',
        permissions: [{ id: 'news.read', titleKey: 'news.permissions.read' }],
        routes: [
          {
            id: 'news.list',
            path: '/plugins/news',
            guard: 'news.read',
            component: () => 'news',
          },
        ],
      },
    ]);
    const rootRoute = { id: 'root' };
    const [route] = routeFactories.map((factory) => factory(rootRoute as never));

    expect(readRouteOptions(route).path).toBe('/plugins/news');
    await expect(
      readRouteOptions(route).beforeLoad?.({
        context: { auth: { getUser: () => ({ roles: ['editor'], permissionActions: ['news.read'] }) } },
        location: { href: '/plugins/news' },
      })
    ).resolves.toBeUndefined();
    expect(createAccountUiRouteGuardMock).not.toHaveBeenCalledWith('content', expect.anything(), '/plugins/news');

    await expect(
      readRouteOptions(route).beforeLoad?.({
        context: { auth: { getUser: () => ({ roles: ['editor'], permissionActions: [] }) } },
        location: { href: '/plugins/news' },
      })
    ).rejects.toMatchObject({
      href: '/?error=auth.insufficientRole',
    });
  });

  it('builds server route factories without requiring app-local route composition', () => {
    const routeFactories = getServerRouteFactories({ bindings, adminResources, diagnostics: vi.fn() });

    expect(routeFactories.some((factory) => readRouteOptions(factory({ id: 'root' } as never)).path === '/auth/login')).toBe(true);
    expect(routeFactories.some((factory) => readRouteOptions(factory({ id: 'root' } as never)).path === '/account')).toBe(true);
  });

  it('maps plugin guards onto canonical account-ui guards', () => {
    expect(mapPluginGuardToAccountGuard('content.read')).toBe('content');
    expect(mapPluginGuardToAccountGuard('content.create')).toBe('contentCreate');
    expect(mapPluginGuardToAccountGuard('content.updatePayload')).toBe('contentDetail');
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

  it('rejects unsupported plugin guards through the client route factory entry points', () => {
    const diagnostics = vi.fn();

    expect(() =>
      getClientRouteFactories({
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
      })
    ).toThrow('plugin_guardrail_unsupported_binding:client-unsupported:client.unsupported:guard');
    expect(diagnostics).not.toHaveBeenCalled();
  });

  it('keeps supported client route factories silent by default when no diagnostics hook is injected', () => {
    const routeFactories = getClientRouteFactories({
      bindings,
      plugins: [
        {
          id: 'silent-plugin',
          displayName: 'Silent plugin',
          routes: [
            {
              id: 'silent.unsupported',
              path: '/plugins/silent-plugin',
              guard: 'content.read',
              component: () => 'silent',
            },
          ],
        },
      ],
    });

    expect(routeFactories.length).toBeGreaterThan(0);
  });

  it('threads a default diagnostics hook through the server route factory entry point', () => {
    getServerRouteFactories({ bindings });

    expect(createAccountUiRouteGuardMock).toHaveBeenCalledWith('account', expect.any(Function), '/account');
  });
});
