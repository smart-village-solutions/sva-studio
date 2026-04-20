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
      expectedGuards: ['adminLegalTexts', 'adminLegalTextCreate', 'adminLegalTextDetail'],
    },
  ] as const)('maps %s routes to the expected account-ui guards', async (resource) => {
    const routeFactories = createAdminResourceRouteFactories(bindings, [resource]);
    const rootRoute = { id: 'root' };
    const routes = routeFactories.map((factory) => factory(rootRoute as never));
    const routeOptions = routes.map((route) => readRouteOptions(route));

    expect(routeOptions.map((route) => route.path)).toEqual(
      resource.views.history
        ? [`/admin/${resource.basePath}`, `/admin/${resource.basePath}/new`, `/admin/${resource.basePath}/$id`, `/admin/${resource.basePath}/$id/history`]
        : [`/admin/${resource.basePath}`, `/admin/${resource.basePath}/new`, `/admin/${resource.basePath}/$id`]
    );
    expect(createAccountUiRouteGuardMock.mock.calls.map(([guardKey]) => guardKey)).toEqual(resource.expectedGuards);

    for (const route of routeOptions) {
      await route.beforeLoad?.({ href: String(route.path) });
      expect(route.getParentRoute?.()).toBe(rootRoute);
    }

    for (const guardKey of resource.expectedGuards) {
      expect(guardSpies[guardKey]).toHaveBeenCalledWith({ href: expect.any(String) });
    }
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
});
