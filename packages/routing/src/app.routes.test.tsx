import { describe, expect, it, vi } from 'vitest';

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

vi.mock('./account-ui.routes', () => ({
  accountUiRouteGuards: guardSpies,
}));

import {
  getClientRouteFactories,
  getPluginRouteFactories,
  getServerRouteFactories,
  mapPluginGuardToAccountGuard,
} from './app.routes';

type RouteOptionsUnderTest = {
  path?: string;
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

    await readRouteOptions(routeMap.get('/account')).beforeLoad?.({ href: '/account' });
    await readRouteOptions(routeMap.get('/admin/users')).beforeLoad?.({ href: '/admin/users' });
    await readRouteOptions(routeMap.get('/plugins/example')).beforeLoad?.({ href: '/plugins/example' });
    await readRouteOptions(routeMap.get('/plugins/news')).beforeLoad?.({ href: '/plugins/news' });

    expect(guardSpies.account).toHaveBeenCalledWith({ href: '/account' });
    expect(guardSpies.adminUsers).toHaveBeenCalledWith({ href: '/admin/users' });
    expect(guardSpies.content).toHaveBeenCalledWith({ href: '/plugins/news' });

    expect(readRouteOptions(routeMap.get('/admin/iam')).validateSearch?.({ tab: 'bogus' })).toEqual({
      tab: 'rights',
    });
    expect(readRouteOptions(routeMap.get('/admin/roles/$roleId')).validateSearch?.({ tab: 'bogus' })).toEqual({
      tab: 'general',
    });
  });

  it('builds server route factories without requiring app-local route composition', () => {
    const routeFactories = getServerRouteFactories({ bindings });

    expect(routeFactories.some((factory) => readRouteOptions(factory({ id: 'root' } as never)).path === '/auth/login')).toBe(true);
    expect(routeFactories.some((factory) => readRouteOptions(factory({ id: 'root' } as never)).path === '/account')).toBe(true);
  });

  it('maps plugin guards onto canonical account-ui guards', () => {
    expect(mapPluginGuardToAccountGuard('content.read')).toBe('content');
    expect(mapPluginGuardToAccountGuard('content.create')).toBe('contentCreate');
    expect(mapPluginGuardToAccountGuard('content.write')).toBe('contentDetail');
    expect(mapPluginGuardToAccountGuard(undefined)).toBeNull();
  });
});
