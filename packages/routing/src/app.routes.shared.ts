import type { AdminResourceDefinition, RouteDocumentation, RouteFactory } from '@sva/plugin-sdk';
import { defineRouteDocumentation, mergeAdminResourceDefinitions } from '@sva/plugin-sdk';
import { createRoute, type AnyRoute, type RootRoute } from '@tanstack/react-router';

import {
  assertNoStaticAdminRouteShadowing,
  collectAdminResourceRoutePaths,
} from './admin-resource-route-conflicts.js';
import type { AppRouteBindings } from './app-route-bindings.js';
import { createAccountUiRouteGuard, type AccountUiRouteGuardKey } from './account-ui.routes.js';
import {
  createAdminResourceRouteFactories,
  createLegacyContentAliasFactories,
} from './admin-resource-routes.js';
import { type RoutingDiagnosticsHook } from './diagnostics.js';
export { mapPluginGuardToAccountGuard } from './plugin-guard-mapping.js';
import type { RouteGuardContext } from './protected.routes.js';
import {
  normalizeIamTab,
  normalizeOrganizationDetailTab,
  normalizeRoleDetailTab,
} from './route-search.js';
import { uiRoutePaths } from './route-paths.js';
import { enforceUiRouteAccessRequirements } from './ui-route-access.js';
import {
  toDocumentationPageCatalogEntry,
  type DocumentationPageCatalogEntry,
} from './route-documentation.js';

export { getAdminDetailRoutePath } from './admin-resource-route-paths.js';
export { getPluginRouteFactories } from './plugin.routes.js';
export type { AppRouteBindings } from './app-route-bindings.js';

export type AppRouteFactory = RouteFactory<RootRoute, AnyRoute>;
export type AppRouteBindingKey = keyof AppRouteBindings;
type UiRouteDefinition = {
  readonly binding: AppRouteBindingKey;
  readonly documentation: RouteDocumentation;
  readonly guard?: AccountUiRouteGuardKey;
  readonly path: string;
  readonly validateSearch?: (search: Record<string, unknown>) => unknown;
  readonly requiredModuleId?: string;
  readonly requiredPermissions?: readonly string[];
};

const page = (
  id: string,
  pageType: Extract<RouteDocumentation, { kind: 'page' }>['pageType']
): RouteDocumentation => defineRouteDocumentation({ kind: 'page', id, pageType });

const excluded = (
  reason: Extract<RouteDocumentation, { kind: 'excluded' }>['reason']
): RouteDocumentation => defineRouteDocumentation({ kind: 'excluded', reason });

const uiRouteDefinitions: readonly UiRouteDefinition[] = [
  { binding: 'home', path: uiRoutePaths.home, documentation: page('home.overview', 'overview') },
  { binding: 'account', path: uiRoutePaths.account, guard: 'account', documentation: page('account.profile', 'overview') },
  { binding: 'accountPrivacy', path: uiRoutePaths.accountPrivacy, guard: 'accountPrivacy', documentation: page('account.privacy', 'overview') },
  {
    binding: 'accountPrivacyDetail',
    path: uiRoutePaths.accountPrivacyDetail,
    guard: 'accountPrivacyDetail',
    documentation: page('account.privacy-detail', 'detail'),
  },
  { binding: 'accountRules', path: uiRoutePaths.accountRules, guard: 'accountRules', documentation: page('account.rules', 'overview') },
  {
    binding: 'mediaUsage',
    path: uiRoutePaths.mediaUsage,
    guard: 'media',
    requiredModuleId: 'media',
    requiredPermissions: ['media.read'],
    documentation: page('media.usage', 'usage'),
  },
  {
    binding: 'media',
    path: uiRoutePaths.media,
    guard: 'media',
    requiredModuleId: 'media',
    requiredPermissions: ['media.read'],
    documentation: page('media.overview', 'overview'),
  },
  {
    binding: 'categories',
    path: uiRoutePaths.categories,
    guard: 'content',
    requiredModuleId: 'categories',
    requiredPermissions: ['categories.read'],
    documentation: page('categories.overview', 'overview'),
  },
  { binding: 'app', path: uiRoutePaths.app, guard: 'account', documentation: page('app.overview', 'overview') },
  {
    binding: 'interfaces',
    path: uiRoutePaths.interfaces,
    guard: 'interfaces',
    requiredPermissions: ['integration.manage'],
    documentation: page('interfaces.overview', 'overview'),
  },
  { binding: 'help', path: uiRoutePaths.help, documentation: excluded('help-page') },
  { binding: 'support', path: uiRoutePaths.support, documentation: excluded('help-page') },
  { binding: 'license', path: uiRoutePaths.license, documentation: excluded('help-page') },
  { binding: 'adminUsers', path: uiRoutePaths.adminUsers, guard: 'adminUsers', documentation: page('admin.users.list', 'list') },
  { binding: 'adminUserCreate', path: uiRoutePaths.adminUserCreate, guard: 'adminUserCreate', documentation: page('admin.users.create', 'create') },
  { binding: 'adminUserDetail', path: uiRoutePaths.adminUserDetail, guard: 'adminUserDetail', documentation: page('admin.users.detail', 'detail') },
  {
    binding: 'adminOrganizations',
    path: uiRoutePaths.adminOrganizations,
    guard: 'adminOrganizations',
    documentation: page('admin.organizations.list', 'list'),
  },
  {
    binding: 'adminOrganizationCreate',
    path: uiRoutePaths.adminOrganizationCreate,
    guard: 'adminOrganizationCreate',
    documentation: page('admin.organizations.create', 'create'),
  },
  {
    binding: 'adminOrganizationDetail',
    path: uiRoutePaths.adminOrganizationDetail,
    guard: 'adminOrganizationDetail',
    documentation: page('admin.organizations.detail', 'detail'),
    validateSearch: (search: Record<string, unknown>) => ({
      tab: normalizeOrganizationDetailTab(search.tab),
    }),
  },
  { binding: 'adminInstances', path: uiRoutePaths.adminInstances, guard: 'adminInstances', documentation: page('admin.instances.list', 'list') },
  {
    binding: 'adminInstanceCreate',
    path: uiRoutePaths.adminInstanceCreate,
    guard: 'adminInstances',
    documentation: page('admin.instances.create', 'create'),
  },
  { binding: 'adminInstanceSetup', path: uiRoutePaths.adminInstanceSetup, guard: 'adminInstances', documentation: page('admin.instances.setup', 'setup') },
  {
    binding: 'adminInstanceDetail',
    path: uiRoutePaths.adminInstanceDetail,
    guard: 'adminInstances',
    documentation: page('admin.instances.detail', 'detail'),
  },
  { binding: 'adminRoles', path: uiRoutePaths.adminRoles, guard: 'adminRoles', documentation: page('admin.roles.list', 'list') },
  { binding: 'adminRoleCreate', path: uiRoutePaths.adminRoleCreate, guard: 'adminRoleCreate', documentation: page('admin.roles.create', 'create') },
  {
    binding: 'adminRoleDetail',
    path: uiRoutePaths.adminRoleDetail,
    guard: 'adminRoleDetail',
    documentation: page('admin.roles.detail', 'detail'),
    validateSearch: (search: Record<string, unknown>) => ({
      tab: normalizeRoleDetailTab(search.tab),
    }),
  },
  { binding: 'adminGroups', path: uiRoutePaths.adminGroups, guard: 'adminGroups', documentation: page('admin.groups.list', 'list') },
  { binding: 'adminGroupCreate', path: uiRoutePaths.adminGroupCreate, guard: 'adminGroupCreate', documentation: page('admin.groups.create', 'create') },
  { binding: 'adminGroupDetail', path: uiRoutePaths.adminGroupDetail, guard: 'adminGroupDetail', documentation: page('admin.groups.detail', 'detail') },
  { binding: 'adminLegalTexts', path: uiRoutePaths.adminLegalTexts, guard: 'adminLegalTexts', documentation: page('admin.legal-texts.list', 'list') },
  {
    binding: 'adminLegalTextCreate',
    path: uiRoutePaths.adminLegalTextCreate,
    guard: 'adminLegalTextCreate',
    documentation: page('admin.legal-texts.create', 'create'),
  },
  {
    binding: 'adminLegalTextDetail',
    path: uiRoutePaths.adminLegalTextDetail,
    guard: 'adminLegalTextDetail',
    documentation: page('admin.legal-texts.detail', 'detail'),
  },
  {
    binding: 'adminIam',
    path: uiRoutePaths.adminIam,
    guard: 'adminIam',
    documentation: page('admin.iam.overview', 'overview'),
    validateSearch: (search: Record<string, unknown>) => ({ tab: normalizeIamTab(search.tab) }),
  },
  {
    binding: 'adminIamGovernanceDetail',
    path: uiRoutePaths.adminIamGovernanceDetail,
    guard: 'adminIam',
    documentation: page('admin.iam.governance-detail', 'detail'),
  },
  { binding: 'adminIamDsrDetail', path: uiRoutePaths.adminIamDsrDetail, guard: 'adminIam', documentation: page('admin.iam.dsr-detail', 'detail') },
  { binding: 'modules', path: uiRoutePaths.modules, guard: 'modules', documentation: page('modules.overview', 'overview') },
  { binding: 'monitoring', path: uiRoutePaths.monitoring, guard: 'monitoring', documentation: page('monitoring.overview', 'overview') },
  { binding: 'monitoringJobs', path: uiRoutePaths.monitoringJobs, guard: 'monitoringJobs', documentation: page('monitoring.jobs-list', 'list') },
  {
    binding: 'monitoringJobDetail',
    path: uiRoutePaths.monitoringJobDetail,
    guard: 'monitoringJobDetail',
    documentation: page('monitoring.job-detail', 'detail'),
  },
  { binding: 'adminApiPhase1Test', path: uiRoutePaths.adminApiPhase1Test, documentation: excluded('technical') },
] as const;

const resolveUiRouteDefinitions = (
  adminResources: readonly AdminResourceDefinition[]
): readonly UiRouteDefinition[] => {
  const adminResourcePaths = collectAdminResourceRoutePaths(adminResources);
  assertNoStaticAdminRouteShadowing(
    adminResourcePaths,
    uiRouteDefinitions.map((definition) => definition.path)
  );
  return uiRouteDefinitions.filter((definition) => !adminResourcePaths.has(definition.path));
};

export const collectUiRouteDocumentationPages = (
  adminResources: readonly AdminResourceDefinition[] = []
): readonly DocumentationPageCatalogEntry[] =>
  resolveUiRouteDefinitions(mergeAdminResourceDefinitions(adminResources)).flatMap((definition) => {
    const entry = toDocumentationPageCatalogEntry({
      documentation: definition.documentation,
      path: definition.path,
      owner: { kind: 'host' },
    });
    return entry ? [entry] : [];
  });

export const createUiRouteFactories = (
  bindings: AppRouteBindings,
  options: {
    readonly adminResources?: readonly AdminResourceDefinition[];
    readonly diagnostics?: RoutingDiagnosticsHook;
  } = {}
): readonly AppRouteFactory[] => {
  const diagnostics = options.diagnostics;
  const adminResources = mergeAdminResourceDefinitions(options.adminResources ?? []);
  const routeDefinitions = resolveUiRouteDefinitions(adminResources);
  return [
    ...routeDefinitions.map((definition) => {
      if (definition.guard) {
        const guard = createAccountUiRouteGuard(definition.guard, diagnostics, definition.path);
        return (rootRoute: RootRoute) =>
          createRoute({
            getParentRoute: () => rootRoute,
            path: definition.path,
            staticData: { documentation: definition.documentation },
            beforeLoad: async (beforeLoadOptions) => {
              await guard(beforeLoadOptions);
              await enforceUiRouteAccessRequirements(definition, {
                context: beforeLoadOptions.context as RouteGuardContext,
              });
            },
            validateSearch: definition.validateSearch,
            component: bindings[definition.binding],
          });
      }

      return (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: definition.path,
          staticData: { documentation: definition.documentation },
          validateSearch: definition.validateSearch,
          component: bindings[definition.binding],
        });
    }),
    ...createAdminResourceRouteFactories(bindings, adminResources, diagnostics),
    ...createLegacyContentAliasFactories(adminResources),
  ];
};
