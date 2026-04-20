import type { AdminResourceDefinition, PluginDefinition, PluginRouteGuard, RouteFactory } from '@sva/sdk';
import { createRoute, redirect, type AnyRoute, type RootRoute, type RouteComponent } from '@tanstack/react-router';

import { createAccountUiRouteGuard, type AccountUiRouteGuardKey } from './account-ui.routes.js';
import {
  emitRoutingDiagnostic,
  type RoutingDiagnosticsHook,
} from './diagnostics.js';
import { normalizeIamTab, normalizeRoleDetailTab } from './route-search.js';
import { uiRoutePaths } from './route-paths.js';

export type AppRouteFactory = RouteFactory<RootRoute, AnyRoute>;

export type AppRouteBindings = {
  readonly home: RouteComponent;
  readonly account: RouteComponent;
  readonly accountPrivacy: RouteComponent;
  readonly content: RouteComponent;
  readonly contentCreate: RouteComponent;
  readonly contentDetail: RouteComponent;
  readonly media: RouteComponent;
  readonly categories: RouteComponent;
  readonly app: RouteComponent;
  readonly interfaces: RouteComponent;
  readonly help: RouteComponent;
  readonly support: RouteComponent;
  readonly license: RouteComponent;
  readonly adminUsers: RouteComponent;
  readonly adminUserCreate: RouteComponent;
  readonly adminUserDetail: RouteComponent;
  readonly adminOrganizations: RouteComponent;
  readonly adminOrganizationCreate: RouteComponent;
  readonly adminOrganizationDetail: RouteComponent;
  readonly adminInstances: RouteComponent;
  readonly adminInstanceCreate: RouteComponent;
  readonly adminInstanceDetail: RouteComponent;
  readonly adminRoles: RouteComponent;
  readonly adminRoleCreate: RouteComponent;
  readonly adminRoleDetail: RouteComponent;
  readonly adminGroups: RouteComponent;
  readonly adminGroupCreate: RouteComponent;
  readonly adminGroupDetail: RouteComponent;
  readonly adminLegalTexts: RouteComponent;
  readonly adminLegalTextCreate: RouteComponent;
  readonly adminLegalTextDetail: RouteComponent;
  readonly adminIam: RouteComponent;
  readonly modules: RouteComponent;
  readonly monitoring: RouteComponent;
  readonly adminApiPhase1Test: RouteComponent;
};

export type AppRouteBindingKey = keyof AppRouteBindings;

type BindingKey = AppRouteBindingKey;

type UiRouteDefinition = {
  readonly binding: BindingKey;
  readonly guard?: AccountUiRouteGuardKey;
  readonly path: string;
  readonly validateSearch?: (search: Record<string, unknown>) => unknown;
};

const uiRouteDefinitions: readonly UiRouteDefinition[] = [
  { binding: 'home', path: uiRoutePaths.home },
  { binding: 'account', path: uiRoutePaths.account, guard: 'account' },
  { binding: 'accountPrivacy', path: uiRoutePaths.accountPrivacy, guard: 'accountPrivacy' },
  { binding: 'media', path: uiRoutePaths.media, guard: 'account' },
  { binding: 'categories', path: uiRoutePaths.categories, guard: 'account' },
  { binding: 'app', path: uiRoutePaths.app, guard: 'account' },
  { binding: 'interfaces', path: uiRoutePaths.interfaces },
  { binding: 'help', path: uiRoutePaths.help },
  { binding: 'support', path: uiRoutePaths.support },
  { binding: 'license', path: uiRoutePaths.license },
  { binding: 'adminUsers', path: uiRoutePaths.adminUsers, guard: 'adminUsers' },
  { binding: 'adminUserCreate', path: uiRoutePaths.adminUserCreate, guard: 'adminUserCreate' },
  { binding: 'adminUserDetail', path: uiRoutePaths.adminUserDetail, guard: 'adminUserDetail' },
  { binding: 'adminOrganizations', path: uiRoutePaths.adminOrganizations, guard: 'adminOrganizations' },
  { binding: 'adminOrganizationCreate', path: uiRoutePaths.adminOrganizationCreate, guard: 'adminOrganizationCreate' },
  { binding: 'adminOrganizationDetail', path: uiRoutePaths.adminOrganizationDetail, guard: 'adminOrganizationDetail' },
  { binding: 'adminInstances', path: uiRoutePaths.adminInstances, guard: 'adminInstances' },
  { binding: 'adminInstanceCreate', path: uiRoutePaths.adminInstanceCreate, guard: 'adminInstances' },
  { binding: 'adminInstanceDetail', path: uiRoutePaths.adminInstanceDetail, guard: 'adminInstances' },
  { binding: 'adminRoles', path: uiRoutePaths.adminRoles, guard: 'adminRoles' },
  { binding: 'adminRoleCreate', path: uiRoutePaths.adminRoleCreate, guard: 'adminRoles' },
  {
    binding: 'adminRoleDetail',
    path: uiRoutePaths.adminRoleDetail,
    guard: 'adminRoleDetail',
    validateSearch: (search: Record<string, unknown>) => ({
      tab: normalizeRoleDetailTab(search.tab),
    }),
  },
  { binding: 'adminGroups', path: uiRoutePaths.adminGroups, guard: 'adminGroups' },
  { binding: 'adminGroupCreate', path: uiRoutePaths.adminGroupCreate, guard: 'adminGroupCreate' },
  { binding: 'adminGroupDetail', path: uiRoutePaths.adminGroupDetail, guard: 'adminGroupDetail' },
  { binding: 'adminLegalTexts', path: uiRoutePaths.adminLegalTexts, guard: 'adminLegalTexts' },
  { binding: 'adminLegalTextCreate', path: uiRoutePaths.adminLegalTextCreate, guard: 'adminLegalTextCreate' },
  { binding: 'adminLegalTextDetail', path: uiRoutePaths.adminLegalTextDetail, guard: 'adminLegalTextDetail' },
  {
    binding: 'adminIam',
    path: uiRoutePaths.adminIam,
    guard: 'adminIam',
    validateSearch: (search: Record<string, unknown>) => ({
      tab: normalizeIamTab(search.tab),
    }),
  },
  { binding: 'modules', path: uiRoutePaths.modules, guard: 'adminRoles' },
  { binding: 'monitoring', path: uiRoutePaths.monitoring, guard: 'adminRoles' },
  { binding: 'adminApiPhase1Test', path: uiRoutePaths.adminApiPhase1Test },
] as const;

type AdminResourceBindingResolver = {
  readonly list: BindingKey;
  readonly create: BindingKey;
  readonly detail: BindingKey;
  readonly history?: BindingKey;
};

type AdminResourceRouteKind = 'list' | 'create' | 'detail' | 'history';

const toAdminRoutePath = (basePath: string) => `/admin/${basePath}` as const;

const getAdminResourceBindings = (resource: AdminResourceDefinition): AdminResourceBindingResolver => ({
  list: resource.views.list.bindingKey as BindingKey,
  create: resource.views.create.bindingKey as BindingKey,
  detail: resource.views.detail.bindingKey as BindingKey,
  history: resource.views.history?.bindingKey as BindingKey | undefined,
});

const resolveAdminResourceGuard = (
  resource: AdminResourceDefinition,
  routeKind: AdminResourceRouteKind
): AccountUiRouteGuardKey => {
  switch (resource.guard) {
    case 'content':
      if (routeKind === 'create') {
        return 'contentCreate';
      }
      if (routeKind === 'detail') {
        return 'contentDetail';
      }
      return 'content';
    case 'adminUsers':
      if (routeKind === 'create') {
        return 'adminUserCreate';
      }
      if (routeKind === 'detail') {
        return 'adminUserDetail';
      }
      return 'adminUsers';
    case 'adminOrganizations':
      if (routeKind === 'create') {
        return 'adminOrganizationCreate';
      }
      if (routeKind === 'detail') {
        return 'adminOrganizationDetail';
      }
      return 'adminOrganizations';
    case 'adminInstances':
      return 'adminInstances';
    case 'adminRoles':
      if (routeKind === 'detail') {
        return 'adminRoleDetail';
      }
      return 'adminRoles';
    case 'adminGroups':
      if (routeKind === 'create') {
        return 'adminGroupCreate';
      }
      if (routeKind === 'detail') {
        return 'adminGroupDetail';
      }
      return 'adminGroups';
    case 'adminLegalTexts':
      if (routeKind === 'create') {
        return 'adminLegalTextCreate';
      }
      if (routeKind === 'detail') {
        return 'adminLegalTextDetail';
      }
      return 'adminLegalTexts';
  }
};

const createAdminResourceRouteDefinitions = (resources: readonly AdminResourceDefinition[]): readonly UiRouteDefinition[] =>
  resources.flatMap((resource) => {
    const bindings = getAdminResourceBindings(resource);
    const basePath = toAdminRoutePath(resource.basePath);

    return [
      {
        binding: bindings.list,
        guard: resolveAdminResourceGuard(resource, 'list'),
        path: basePath,
      },
      {
        binding: bindings.create,
        guard: resolveAdminResourceGuard(resource, 'create'),
        path: `${basePath}/new`,
      },
      {
        binding: bindings.detail,
        guard: resolveAdminResourceGuard(resource, 'detail'),
        path: `${basePath}/$id`,
      },
      ...(bindings.history
        ? [
            {
              binding: bindings.history,
              guard: resolveAdminResourceGuard(resource, 'history'),
              path: `${basePath}/$id/history`,
            } satisfies UiRouteDefinition,
          ]
        : []),
    ] as const;
  });

const LEGACY_CONTENT_ALIAS_PREFIX = '/content';

const readBeforeLoadHref = (options: unknown): string => {
  const candidate = options as {
    href?: unknown;
    location?: { href?: unknown };
  };

  if (typeof candidate.location?.href === 'string' && candidate.location.href.length > 0) {
    return candidate.location.href;
  }
  if (typeof candidate.href === 'string' && candidate.href.length > 0) {
    return candidate.href;
  }

  return LEGACY_CONTENT_ALIAS_PREFIX;
};

const normalizeLegacyContentHref = (href: string): string => {
  if (href === LEGACY_CONTENT_ALIAS_PREFIX || href.startsWith(`${LEGACY_CONTENT_ALIAS_PREFIX}?`)) {
    return href.replace(LEGACY_CONTENT_ALIAS_PREFIX, uiRoutePaths.content);
  }
  if (href.startsWith(`${LEGACY_CONTENT_ALIAS_PREFIX}/new`)) {
    return href.replace(`${LEGACY_CONTENT_ALIAS_PREFIX}/new`, uiRoutePaths.contentCreate);
  }
  if (href.startsWith(`${LEGACY_CONTENT_ALIAS_PREFIX}/`)) {
    return href.replace(`${LEGACY_CONTENT_ALIAS_PREFIX}/`, `${uiRoutePaths.content}/`);
  }

  return uiRoutePaths.content;
};

const createLegacyContentAliasFactories = (): readonly AppRouteFactory[] => {
  const aliasPaths = ['/content', '/content/new', '/content/$contentId'] as const;

  return aliasPaths.map(
    (path) =>
      (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          beforeLoad: (options) => {
            throw redirect({ href: normalizeLegacyContentHref(readBeforeLoadHref(options)) });
          },
          component: () => null,
        })
  );
};

export const createUiRouteFactories = (
  bindings: AppRouteBindings,
  options: {
    readonly adminResources?: readonly AdminResourceDefinition[];
    readonly diagnostics?: RoutingDiagnosticsHook;
  } = {}
): readonly AppRouteFactory[] => {
  const diagnostics = options.diagnostics;
  const routeDefinitions = [
    ...uiRouteDefinitions,
    ...createAdminResourceRouteDefinitions(options.adminResources ?? []),
  ] as const;

  return [
    ...routeDefinitions.map((definition) => {
    if (definition.guard) {
      const guard = createAccountUiRouteGuard(definition.guard, diagnostics, definition.path);

      return (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: definition.path,
          beforeLoad: (beforeLoadOptions) => guard(beforeLoadOptions),
          validateSearch: definition.validateSearch,
          component: bindings[definition.binding],
        });
    }

    return (rootRoute: RootRoute) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path: definition.path,
        validateSearch: definition.validateSearch,
        component: bindings[definition.binding],
      });
  }),
    ...createLegacyContentAliasFactories(),
  ];
};

export const mapPluginGuardToAccountGuard = (
  guard?: PluginRouteGuard
): 'content' | 'contentCreate' | 'contentDetail' | null => {
  switch (guard) {
    case 'content.read':
      return 'content';
    case 'content.create':
      return 'contentCreate';
    case 'content.write':
      return 'contentDetail';
    default:
      return null;
  }
};

export const getPluginRouteFactories = (
  pluginDefinitions: readonly PluginDefinition[] = [],
  options: {
    readonly diagnostics?: RoutingDiagnosticsHook;
  } = {}
): readonly AppRouteFactory[] => {
  const diagnostics = options.diagnostics;

  return pluginDefinitions.flatMap((pluginDefinition) =>
    pluginDefinition.routes.map((routeDefinition) => {
      const guardKey = mapPluginGuardToAccountGuard(routeDefinition.guard);
      const guard = guardKey ? createAccountUiRouteGuard(guardKey, diagnostics, routeDefinition.path) : null;
      const unsupportedGuard = !guardKey && routeDefinition.guard ? routeDefinition.guard : null;

      if (unsupportedGuard) {
        emitRoutingDiagnostic(diagnostics, {
          level: 'warn',
          event: 'routing.plugin.guard_unsupported',
          route: routeDefinition.path,
          reason: 'unsupported-plugin-guard',
          plugin: pluginDefinition.id,
          unsupported_guard: unsupportedGuard,
        });
      }

      return (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: routeDefinition.path,
          beforeLoad: guard ? (options) => guard(options) : undefined,
          component: routeDefinition.component as RouteComponent,
        });
    })
  );
};
