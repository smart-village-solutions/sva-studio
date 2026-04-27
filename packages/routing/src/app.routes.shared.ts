import type { AdminResourceDefinition, PluginDefinition, PluginRouteGuard, RouteFactory } from '@sva/plugin-sdk';
import { assertPluginRoutePathAllowed, createPluginGuardrailError, mergeAdminResourceDefinitions } from '@sva/plugin-sdk';
import { createRoute, type AnyRoute, type RootRoute, type RouteComponent } from '@tanstack/react-router';

import { createAccountUiRouteGuard, type AccountUiRouteGuardKey } from './account-ui.routes.js';
import { createProtectedRoute } from './protected.routes.js';
import {
  adminDetailParamNameByBinding,
  createAdminResourceRouteFactories,
  createLegacyContentAliasFactories,
} from './admin-resource-routes.js';
import { type RoutingDiagnosticsHook } from './diagnostics.js';
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

type UiRouteDefinition = {
  readonly binding: AppRouteBindingKey;
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

export const getAdminDetailRoutePath = (basePath: string, bindingKey: string): string => {
  const detailParamName =
    adminDetailParamNameByBinding[bindingKey as keyof typeof adminDetailParamNameByBinding] ??
    adminDetailParamNameByBinding.contentDetail;
  return `${basePath}/$${detailParamName}`;
};

const collectAdminResourceRoutePaths = (resources: readonly AdminResourceDefinition[]): ReadonlyMap<string, string> => {
  const paths = new Map<string, string>();

  for (const resource of resources) {
    const basePath = `/admin/${resource.basePath}`;
    const detailPath = getAdminDetailRoutePath(basePath, resource.views.detail.bindingKey);
    paths.set(basePath, resource.resourceId);
    paths.set(`${basePath}/new`, resource.resourceId);
    paths.set(detailPath, resource.resourceId);
    if (resource.views.history) {
      paths.set(`${detailPath}/history`, resource.resourceId);
    }
  }

  return paths;
};

const assertNoStaticAdminRouteShadowing = (adminResourcePaths: ReadonlyMap<string, string>): void => {
  for (const definition of uiRouteDefinitions) {
    const resourceId = adminResourcePaths.get(definition.path);
    if (resourceId && definition.path.startsWith('/admin/')) {
      throw new Error(`admin_resource_static_route_conflict:${resourceId}:${definition.path}`);
    }
  }
};

export const createUiRouteFactories = (
  bindings: AppRouteBindings,
  options: {
    readonly adminResources?: readonly AdminResourceDefinition[];
    readonly diagnostics?: RoutingDiagnosticsHook;
  } = {}
): readonly AppRouteFactory[] => {
  const diagnostics = options.diagnostics;
  const adminResources = mergeAdminResourceDefinitions(options.adminResources ?? []);
  const adminResourcePaths = collectAdminResourceRoutePaths(adminResources);
  assertNoStaticAdminRouteShadowing(adminResourcePaths);
  const routeDefinitions = uiRouteDefinitions.filter((definition) => !adminResourcePaths.has(definition.path));
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
    ...createAdminResourceRouteFactories(bindings, adminResources, diagnostics),
    ...createLegacyContentAliasFactories(adminResources),
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
    case 'content.updateMetadata':
    case 'content.updatePayload':
    case 'content.changeStatus':
    case 'content.publish':
    case 'content.archive':
    case 'content.restore':
    case 'content.readHistory':
    case 'content.manageRevisions':
    case 'content.delete':
      return 'contentDetail';
    default:
      return null;
  }
};

const isPluginPermissionGuard = (guard: string): boolean =>
  /^[a-z][a-z0-9-]{1,30}\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guard) && guard.startsWith('content.') === false;

const hasRegisteredPluginPermissionGuard = (pluginDefinition: PluginDefinition, guard: string): boolean =>
  pluginDefinition.permissions?.some((permission) => permission.id.trim() === guard) === true;

const resolvePluginRouteGuard = (
  pluginDefinition: PluginDefinition,
  routeDefinition: PluginDefinition['routes'][number],
  diagnostics: RoutingDiagnosticsHook | undefined
) => {
  const guardKey = mapPluginGuardToAccountGuard(routeDefinition.guard);
  if (guardKey) {
    return createAccountUiRouteGuard(guardKey, diagnostics, routeDefinition.path);
  }

  const pluginPermissionGuard = routeDefinition.guard;
  if (!pluginPermissionGuard) {
    return null;
  }
  if (!isPluginPermissionGuard(pluginPermissionGuard)) {
    return null;
  }
  if (!hasRegisteredPluginPermissionGuard(pluginDefinition, pluginPermissionGuard)) {
    return null;
  }

  return createProtectedRoute({
    diagnostics,
    route: routeDefinition.path,
    requiredPermissions: [pluginPermissionGuard],
  });
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
      const guard = resolvePluginRouteGuard(pluginDefinition, routeDefinition, diagnostics);
      const unsupportedGuard = !guard && routeDefinition.guard ? routeDefinition.guard : null;
      const pluginNamespace = pluginDefinition.id.trim();
      const contributionId = routeDefinition.id.trim();

      assertPluginRoutePathAllowed(pluginNamespace, contributionId, routeDefinition.path);

      if (unsupportedGuard) {
        throw createPluginGuardrailError({
          code: 'plugin_guardrail_unsupported_binding',
          pluginNamespace,
          contributionId,
          fieldOrReason: 'guard',
        });
      }

      return (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: routeDefinition.path,
          beforeLoad: guard ?? undefined,
          component: routeDefinition.component as RouteComponent,
        });
    })
  );
};
