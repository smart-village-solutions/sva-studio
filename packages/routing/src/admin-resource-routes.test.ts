import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardSpies = vi.hoisted(() => ({
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
}));

const createAccountUiRouteGuardMock = vi.hoisted(() =>
  vi.fn((guardKey: keyof typeof guardSpies) => guardSpies[guardKey])
);

type GuardKey = keyof typeof guardSpies;

const createRouteMock = vi.hoisted(() =>
  vi.fn((options: Record<string, unknown>) => ({
    options,
  }))
);

const redirectMock = vi.hoisted(() => vi.fn((options: Record<string, unknown>) => ({ ...options, __redirect: true })));

vi.mock('@tanstack/react-router', () => ({
  createRoute: createRouteMock,
  redirect: redirectMock,
}));

vi.mock('./account-ui.routes.js', () => ({
  createAccountUiRouteGuard: createAccountUiRouteGuardMock,
}));

import { createAdminResourceRouteFactories, createLegacyContentAliasFactories } from './admin-resource-routes.js';
import type { AppRouteBindings } from './app.routes.shared.js';

type RouteOptionsUnderTest = {
  path?: string;
  getParentRoute?: () => unknown;
  beforeLoad?: (options: unknown) => Promise<void> | void;
  component?: () => unknown;
};

const bindings: AppRouteBindings = {
  home: () => 'home',
  account: () => 'account',
  accountPrivacy: () => 'accountPrivacy',
  content: () => 'content',
  contentCreate: () => 'contentCreate',
  contentDetail: () => 'contentDetail',
  media: () => 'media',
  categories: () => 'categories',
  app: () => 'app',
  interfaces: () => 'interfaces',
  help: () => 'help',
  support: () => 'support',
  license: () => 'license',
  adminUsers: () => 'adminUsers',
  adminUserCreate: () => 'adminUserCreate',
  adminUserDetail: () => 'adminUserDetail',
  adminOrganizations: () => 'adminOrganizations',
  adminOrganizationCreate: () => 'adminOrganizationCreate',
  adminOrganizationDetail: () => 'adminOrganizationDetail',
  adminInstances: () => 'adminInstances',
  adminInstanceCreate: () => 'adminInstanceCreate',
  adminInstanceDetail: () => 'adminInstanceDetail',
  adminRoles: () => 'adminRoles',
  adminRoleCreate: () => 'adminRoleCreate',
  adminRoleDetail: () => 'adminRoleDetail',
  adminGroups: () => 'adminGroups',
  adminGroupCreate: () => 'adminGroupCreate',
  adminGroupDetail: () => 'adminGroupDetail',
  adminLegalTexts: () => 'adminLegalTexts',
  adminLegalTextCreate: () => 'adminLegalTextCreate',
  adminLegalTextDetail: () => 'adminLegalTextDetail',
  adminIam: () => 'adminIam',
  modules: () => 'modules',
  monitoring: () => 'monitoring',
  adminApiPhase1Test: () => 'adminApiPhase1Test',
};

const specializedBindings = {
  ...bindings,
  newsList: () => 'newsList',
  newsDetail: () => 'newsDetail',
  newsEditor: () => 'newsEditor',
} as AppRouteBindings & Record<'newsList' | 'newsDetail' | 'newsEditor', () => string>;

const readRouteOptions = (route: unknown): RouteOptionsUnderTest =>
  (route as { options: RouteOptionsUnderTest }).options;

describe('admin resource routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      guard: 'content',
      resourceId: 'content',
      basePath: 'content',
      titleKey: 'content.title',
      views: {
        list: { bindingKey: 'content' },
        create: { bindingKey: 'contentCreate' },
        detail: { bindingKey: 'contentDetail' },
      },
      expectedPaths: ['/admin/content', '/admin/content/new', '/admin/content/$id'],
      expectedGuards: ['content', 'contentCreate', 'contentDetail'],
    },
    {
      guard: 'adminUsers',
      resourceId: 'iam.users',
      basePath: 'users',
      titleKey: 'iam.users.title',
      views: {
        list: { bindingKey: 'adminUsers' },
        create: { bindingKey: 'adminUserCreate' },
        detail: { bindingKey: 'adminUserDetail' },
      },
      expectedPaths: ['/admin/users', '/admin/users/new', '/admin/users/$userId'],
      expectedGuards: ['adminUsers', 'adminUserCreate', 'adminUserDetail'],
    },
    {
      guard: 'adminOrganizations',
      resourceId: 'iam.organizations',
      basePath: 'organizations',
      titleKey: 'iam.organizations.title',
      views: {
        list: { bindingKey: 'adminOrganizations' },
        create: { bindingKey: 'adminOrganizationCreate' },
        detail: { bindingKey: 'adminOrganizationDetail' },
      },
      expectedPaths: ['/admin/organizations', '/admin/organizations/new', '/admin/organizations/$organizationId'],
      expectedGuards: ['adminOrganizations', 'adminOrganizationCreate', 'adminOrganizationDetail'],
    },
    {
      guard: 'adminInstances',
      resourceId: 'iam.instances',
      basePath: 'instances',
      titleKey: 'iam.instances.title',
      views: {
        list: { bindingKey: 'adminInstances' },
        create: { bindingKey: 'adminInstanceCreate' },
        detail: { bindingKey: 'adminInstanceDetail' },
      },
      expectedPaths: ['/admin/instances', '/admin/instances/new', '/admin/instances/$instanceId'],
      expectedGuards: ['adminInstances', 'adminInstances', 'adminInstances'],
    },
    {
      guard: 'adminRoles',
      resourceId: 'iam.roles',
      basePath: 'roles',
      titleKey: 'iam.roles.title',
      views: {
        list: { bindingKey: 'adminRoles' },
        create: { bindingKey: 'adminRoleCreate' },
        detail: { bindingKey: 'adminRoleDetail' },
        history: { bindingKey: 'adminRoles' },
      },
      expectedPaths: ['/admin/roles', '/admin/roles/new', '/admin/roles/$roleId', '/admin/roles/$roleId/history'],
      expectedGuards: ['adminRoles', 'adminRoles', 'adminRoleDetail', 'adminRoles'],
    },
    {
      guard: 'adminGroups',
      resourceId: 'iam.groups',
      basePath: 'groups',
      titleKey: 'iam.groups.title',
      views: {
        list: { bindingKey: 'adminGroups' },
        create: { bindingKey: 'adminGroupCreate' },
        detail: { bindingKey: 'adminGroupDetail' },
      },
      expectedPaths: ['/admin/groups', '/admin/groups/new', '/admin/groups/$groupId'],
      expectedGuards: ['adminGroups', 'adminGroupCreate', 'adminGroupDetail'],
    },
    {
      guard: 'adminLegalTexts',
      resourceId: 'iam.legal-texts',
      basePath: 'legal-texts',
      titleKey: 'iam.legal-texts.title',
      views: {
        list: { bindingKey: 'adminLegalTexts' },
        create: { bindingKey: 'adminLegalTextCreate' },
        detail: { bindingKey: 'adminLegalTextDetail' },
      },
      expectedPaths: ['/admin/legal-texts', '/admin/legal-texts/new', '/admin/legal-texts/$legalTextVersionId'],
      expectedGuards: ['adminLegalTexts', 'adminLegalTextCreate', 'adminLegalTextDetail'],
    },
  ] as const)('maps %s routes to the expected account-ui guards', async (resource) => {
    const routeFactories = createAdminResourceRouteFactories(bindings, [resource]);
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeOptions = routes.map((route) => readRouteOptions(route));
    const expectedPaths =
      resource.resourceId === 'content'
        ? resource.expectedPaths
        : ['/admin/content', '/admin/content/new', '/admin/content/$id', ...resource.expectedPaths];
    const expectedGuards: readonly GuardKey[] =
      resource.resourceId === 'content'
        ? resource.expectedGuards
        : ['content', 'contentCreate', 'contentDetail', ...resource.expectedGuards];

    expect(routeOptions.map((route) => route.path)).toEqual(expectedPaths);
    expect(createAccountUiRouteGuardMock.mock.calls.map(([guardKey]) => guardKey)).toEqual(expectedGuards);

    for (const route of routeOptions) {
      await route.beforeLoad?.({ href: String(route.path) });
      expect(route.getParentRoute?.()).toBe(rootRoute);
    }

    for (const guardKey of expectedGuards) {
      expect(guardSpies[guardKey]).toHaveBeenCalledWith({ href: expect.any(String) });
    }
  });

  it('normalizes declared list search params for admin resources with list capabilities', () => {
    const routeFactories = createAdminResourceRouteFactories(bindings, [
      {
        resourceId: 'news.content',
        basePath: 'news',
        titleKey: 'news.navigation.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
        capabilities: {
          list: {
            pagination: { defaultPageSize: 25, pageSizeOptions: [10, 25, 50] },
            search: { param: 'q' },
          },
        },
      } as never,
    ]);
    const rootRoute = { id: 'root' };
    const listRoute = routeFactories
      .map((factory) => factory(rootRoute as never))
      .map((route) => readRouteOptions(route))
      .find((route) => route.path === '/admin/news');

    expect(listRoute?.validateSearch?.({ q: 'news', page: '2', pageSize: '50' })).toEqual({
      filters: {},
      page: 2,
      pageSize: 50,
      search: 'news',
      sort: undefined,
    });
  });

  it('materializes specialized content ui bindings inside host-owned admin routes', () => {
    const routeFactories = createAdminResourceRouteFactories(specializedBindings, [
      {
        resourceId: 'news.content',
        basePath: 'news',
        titleKey: 'news.navigation.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
        contentUi: {
          contentType: 'news.article',
          bindings: {
            list: { bindingKey: 'newsList' },
            detail: { bindingKey: 'newsDetail' },
            editor: { bindingKey: 'newsEditor' },
          },
        },
      } as never,
    ]);
    const rootRoute = { id: 'root' };
    const routeMap = new Map(
      routeFactories
        .map((factory) => factory(rootRoute as never))
        .map((route) => readRouteOptions(route))
        .map((route) => [String(route.path), route])
    );

    expect(routeMap.get('/admin/news')?.component?.()).toBe('newsList');
    expect(routeMap.get('/admin/news/new')?.component?.()).toBe('newsEditor');
    expect(routeMap.get('/admin/news/$id')?.component?.()).toBe('newsDetail');
  });

  it('falls back to host-owned content bindings when specialized content ui bindings are omitted', () => {
    const routeFactories = createAdminResourceRouteFactories(specializedBindings, [
      {
        resourceId: 'news.content',
        basePath: 'news',
        titleKey: 'news.navigation.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
        contentUi: {
          contentType: 'news.article',
          bindings: {
            list: { bindingKey: 'newsList' },
          },
        },
      } as never,
    ]);
    const rootRoute = { id: 'root' };
    const routeMap = new Map(
      routeFactories
        .map((factory) => factory(rootRoute as never))
        .map((route) => readRouteOptions(route))
        .map((route) => [String(route.path), route])
    );

    expect(routeMap.get('/admin/news')?.component?.()).toBe('newsList');
    expect(routeMap.get('/admin/news/new')?.component?.()).toBe('contentCreate');
    expect(routeMap.get('/admin/news/$id')?.component?.()).toBe('contentDetail');
  });

  it('redirects legacy content aliases using href and location.href fallbacks', () => {
    const routeFactories = createLegacyContentAliasFactories();
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(() =>
      readRouteOptions(routeMap.get('/content')).beforeLoad?.({ location: { href: '/content?page=3' } })
    ).toThrow(expect.objectContaining({ href: '/admin/content?page=3', __redirect: true }));
    expect(() => readRouteOptions(routeMap.get('/content/new')).beforeLoad?.({ href: '/content/new' })).toThrow(
      expect.objectContaining({ href: '/admin/content/new', __redirect: true })
    );
    expect(() => readRouteOptions(routeMap.get('/content/$contentId')).beforeLoad?.({})).toThrow(
      expect.objectContaining({ href: '/admin/content', __redirect: true })
    );
    expect(() => readRouteOptions(routeMap.get('/content/$contentId')).beforeLoad?.({ href: '/unexpected' })).toThrow(
      expect.objectContaining({ href: '/admin/content', __redirect: true })
    );
    expect(readRouteOptions(routeMap.get('/content')).getParentRoute?.()).toBe(rootRoute);
    expect(readRouteOptions(routeMap.get('/content')).component?.()).toBeNull();
  });

  it('rejects unknown admin resource binding keys before route creation', () => {
    expect(() =>
      createAdminResourceRouteFactories(bindings, [
        {
          resourceId: 'news.entries',
          basePath: 'news',
          titleKey: 'news.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'unknownListBinding' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('unknown_admin_resource_binding_key:news.entries:list:unknownListBinding');
  });

  it('rejects prototype property binding keys before route creation', () => {
    expect(() =>
      createAdminResourceRouteFactories(bindings, [
        {
          resourceId: 'news.entries',
          basePath: 'news',
          titleKey: 'news.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'toString' as never },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('unknown_admin_resource_binding_key:news.entries:list:toString');
  });

  it('rejects missing admin resource binding keys before route creation', () => {
    expect(() =>
      createAdminResourceRouteFactories(bindings, [
        {
          resourceId: 'news.entries',
          basePath: 'news',
          titleKey: 'news.title',
          guard: 'content',
          views: {
            list: { bindingKey: undefined as never },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'contentDetail' },
          },
        },
      ])
    ).toThrow('unknown_admin_resource_binding_key:news.entries:list:');
  });

  it('rejects unsupported admin detail bindings after key validation', () => {
    expect(() =>
      createAdminResourceRouteFactories(bindings, [
        {
          resourceId: 'news.entries',
          basePath: 'news',
          titleKey: 'news.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'content' },
            create: { bindingKey: 'contentCreate' },
            detail: { bindingKey: 'help' as never },
          },
        },
      ])
    ).toThrow('unsupported_admin_resource_detail_binding:help');
  });

  it('does not inject the core content admin resource twice when it is already provided', () => {
    const routeFactories = createAdminResourceRouteFactories(bindings, [
      {
        resourceId: 'content',
        basePath: 'content',
        titleKey: 'content.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
      },
    ]);
    const rootRoute = { id: 'root' };
    const paths = routeFactories.map((factory) => String(readRouteOptions(factory(rootRoute as never)).path));

    expect(paths).toEqual(['/admin/content', '/admin/content/new', '/admin/content/$id']);
  });

  it('derives legacy content redirects from the registered content base path', () => {
    const routeFactories = createLegacyContentAliasFactories([
      {
        resourceId: 'content',
        basePath: 'editorial-content',
        titleKey: 'content.title',
        guard: 'content',
        views: {
          list: { bindingKey: 'content' },
          create: { bindingKey: 'contentCreate' },
          detail: { bindingKey: 'contentDetail' },
        },
      },
    ]);
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeMap = new Map(routes.map((route) => [String(readRouteOptions(route).path), route]));

    expect(() => readRouteOptions(routeMap.get('/content')).beforeLoad?.({ href: '/content?page=1' })).toThrow(
      expect.objectContaining({ href: '/admin/editorial-content?page=1', __redirect: true })
    );
    expect(() => readRouteOptions(routeMap.get('/content/new')).beforeLoad?.({ href: '/content/new?mode=copy' })).toThrow(
      expect.objectContaining({ href: '/admin/editorial-content/new?mode=copy', __redirect: true })
    );
    expect(
      () => readRouteOptions(routeMap.get('/content/$contentId')).beforeLoad?.({ href: '/content/content-7' })
    ).toThrow(expect.objectContaining({ href: '/admin/editorial-content/content-7', __redirect: true }));
  });
});
