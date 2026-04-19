import { createBrowserLogger, type PluginDefinition, type PluginRouteGuard, type RouteFactory } from '@sva/sdk';
import { createRoute, type AnyRoute, type RootRoute, type RouteComponent } from '@tanstack/react-router';

import { createAccountUiRouteGuard, type AccountUiRouteGuardKey } from './account-ui.routes.js';
import {
  createRoutingDiagnosticsLogger,
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

type BindingKey = keyof AppRouteBindings;

type UiRouteDefinition = {
  readonly binding: BindingKey;
  readonly guard?: AccountUiRouteGuardKey;
  readonly path: (typeof uiRoutePaths)[BindingKey];
  readonly validateSearch?: (search: Record<string, unknown>) => unknown;
};

const uiRouteDefinitions: readonly UiRouteDefinition[] = [
  { binding: 'home', path: uiRoutePaths.home },
  { binding: 'account', path: uiRoutePaths.account, guard: 'account' },
  { binding: 'accountPrivacy', path: uiRoutePaths.accountPrivacy, guard: 'accountPrivacy' },
  { binding: 'content', path: uiRoutePaths.content, guard: 'content' },
  { binding: 'contentCreate', path: uiRoutePaths.contentCreate, guard: 'contentCreate' },
  { binding: 'contentDetail', path: uiRoutePaths.contentDetail, guard: 'contentDetail' },
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

const defaultRoutingDiagnostics = createRoutingDiagnosticsLogger(
  createBrowserLogger({ component: 'routing', level: 'info' })
);

export const createUiRouteFactories = (
  bindings: AppRouteBindings,
  options: {
    readonly diagnostics?: RoutingDiagnosticsHook;
  } = {}
): readonly AppRouteFactory[] => {
  const diagnostics = options.diagnostics ?? defaultRoutingDiagnostics;

  return uiRouteDefinitions.map((definition) => {
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
  });
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
  const diagnostics = options.diagnostics ?? defaultRoutingDiagnostics;

  return pluginDefinitions.flatMap((pluginDefinition) =>
    pluginDefinition.routes.map((routeDefinition) => {
      const guardKey = mapPluginGuardToAccountGuard(routeDefinition.guard);
      const guard = guardKey ? createAccountUiRouteGuard(guardKey, diagnostics, routeDefinition.path) : null;
      const unsupportedGuard = !guardKey && routeDefinition.guard ? routeDefinition.guard : null;

      return (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: routeDefinition.path,
          beforeLoad: (options) => {
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

            if (!guard) {
              return;
            }

            return guard(options);
          },
          component: routeDefinition.component as RouteComponent,
        });
    })
  );
};
