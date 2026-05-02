import type { AdminResourceDefinition } from '@sva/plugin-sdk';
import { createRoute, redirect, type RootRoute } from '@tanstack/react-router';

import {
  LEGACY_CONTENT_ALIAS_PREFIX,
  normalizeLegacyAdminResourceHref,
  normalizeLegacyContentHref,
  readBeforeLoadHref,
  resolveCanonicalContentAdminRoutePath,
  withCoreContentAdminResource,
} from './admin-resource-route-aliases.js';
import {
  adminDetailParamNameByBinding,
  getAdminDetailRoutePath,
  toAdminCreateRoutePath,
  toAdminHistoryRoutePath,
  toAdminRoutePath,
} from './admin-resource-route-paths.js';
import { createAccountUiRouteGuard, type AccountUiRouteGuardKey } from './account-ui.routes.js';
import { normalizeAdminResourceListSearch } from './admin-resource-search-params.js';
import type { AppRouteBindings, AppRouteFactory } from './app.routes.shared.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';

type BindingKey = keyof AppRouteBindings;
type UiRouteDefinition = {
  readonly binding: BindingKey;
  readonly guard: AccountUiRouteGuardKey;
  readonly path: string;
  readonly routeKind: AdminResourceRouteKind;
  readonly resource: AdminResourceDefinition;
  readonly validateSearch?: (search: Record<string, unknown>) => unknown;
};
type AdminResourceBindingResolver = { readonly list: BindingKey; readonly create: BindingKey; readonly detail: BindingKey; readonly history?: BindingKey };
type AdminResourceRouteKind = 'list' | 'create' | 'detail' | 'history';
type AdminResourceViewKind = keyof AdminResourceDefinition['views'];
const hasBindingKey = (bindings: AppRouteBindings, bindingKey: string): bindingKey is BindingKey =>
  Object.prototype.hasOwnProperty.call(bindings, bindingKey);

const resolveBindingKey = (
  bindings: AppRouteBindings,
  resource: AdminResourceDefinition,
  viewName: AdminResourceViewKind,
  bindingKey: string | undefined
): BindingKey => {
  if (typeof bindingKey !== 'string' || !hasBindingKey(bindings, bindingKey)) {
    throw new Error(`unknown_admin_resource_binding_key:${resource.resourceId}:${viewName}:${bindingKey ?? ''}`);
  }
  return bindingKey;
};

const resolveOptionalContentUiBindingKey = (
  bindings: AppRouteBindings,
  resource: AdminResourceDefinition,
  viewName: 'list' | 'detail' | 'editor'
): BindingKey | undefined => {
  const bindingKey = resource.contentUi?.bindings?.[viewName]?.bindingKey;
  if (bindingKey === undefined) {
    return undefined;
  }
  if (!hasBindingKey(bindings, bindingKey)) {
    throw new Error(`unknown_admin_resource_binding_key:${resource.resourceId}:contentUi.${viewName}:${bindingKey}`);
  }
  return bindingKey;
};
const getAdminResourceBindings = (bindings: AppRouteBindings, resource: AdminResourceDefinition): AdminResourceBindingResolver => {
  const defaultList = resolveBindingKey(bindings, resource, 'list', resource.views.list.bindingKey);
  const defaultCreate = resolveBindingKey(bindings, resource, 'create', resource.views.create.bindingKey);
  const defaultDetail = resolveBindingKey(bindings, resource, 'detail', resource.views.detail.bindingKey);
  const specializedList = resolveOptionalContentUiBindingKey(bindings, resource, 'list');
  const specializedDetail = resolveOptionalContentUiBindingKey(bindings, resource, 'detail');
  const specializedEditor = resolveOptionalContentUiBindingKey(bindings, resource, 'editor');
  return {
    list: specializedList ?? defaultList,
    create: specializedEditor ?? defaultCreate,
    detail: specializedDetail ?? specializedEditor ?? defaultDetail,
    history: resource.views.history
      ? resolveBindingKey(bindings, resource, 'history', resource.views.history.bindingKey)
      : undefined,
  };
};

const assertSupportedAdminDetailBinding = (bindingKey: BindingKey): void => {
  if (!Object.prototype.hasOwnProperty.call(adminDetailParamNameByBinding, bindingKey)) {
    throw new Error(`unsupported_admin_resource_detail_binding:${bindingKey}`);
  }
};
const adminResourceGuardMap = {
  content: { list: 'content', create: 'contentCreate', detail: 'contentDetail', history: 'content' },
  media: { list: 'media', create: 'media', detail: 'media', history: 'media' },
  adminUsers: { list: 'adminUsers', create: 'adminUserCreate', detail: 'adminUserDetail', history: 'adminUsers' },
  adminOrganizations: { list: 'adminOrganizations', create: 'adminOrganizationCreate', detail: 'adminOrganizationDetail', history: 'adminOrganizations' },
  adminInstances: { list: 'adminInstances', create: 'adminInstances', detail: 'adminInstances', history: 'adminInstances' },
  adminRoles: { list: 'adminRoles', create: 'adminRoles', detail: 'adminRoleDetail', history: 'adminRoles' },
  adminGroups: { list: 'adminGroups', create: 'adminGroupCreate', detail: 'adminGroupDetail', history: 'adminGroups' },
  adminLegalTexts: { list: 'adminLegalTexts', create: 'adminLegalTextCreate', detail: 'adminLegalTextDetail', history: 'adminLegalTexts' },
} as const satisfies Record<AdminResourceDefinition['guard'], Record<AdminResourceRouteKind, AccountUiRouteGuardKey>>;
const resolveAdminResourceGuard = (resource: AdminResourceDefinition, routeKind: AdminResourceRouteKind): AccountUiRouteGuardKey =>
  adminResourceGuardMap[resource.guard][routeKind];

const ensureAssignedModule = async (
  resource: AdminResourceDefinition,
  beforeLoadOptions: {
    readonly context?: {
      readonly auth?: {
        readonly getUser?: () => Promise<{ assignedModules?: readonly string[] } | null | undefined>;
      };
    };
  }
): Promise<void> => {
  if (!resource.moduleId) {
    return;
  }
  const user = await beforeLoadOptions.context?.auth?.getUser?.();
  if (!user?.assignedModules?.includes(resource.moduleId)) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};

const ensureRequiredPermissions = async (
  resource: AdminResourceDefinition,
  routeKind: AdminResourceRouteKind,
  beforeLoadOptions: {
    readonly context?: {
      readonly auth?: {
        readonly getUser?: () => Promise<{ permissionActions?: readonly string[] } | null | undefined>;
      };
    };
  }
): Promise<void> => {
  const requiredPermissions = resource.permissions?.[routeKind];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return;
  }

  const user = await beforeLoadOptions.context?.auth?.getUser?.();
  const grantedPermissions = new Set(user?.permissionActions ?? []);
  if (requiredPermissions.some((permission) => !grantedPermissions.has(permission))) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};
const createListRouteDefinition = (resource: AdminResourceDefinition, binding: BindingKey, basePath: string): UiRouteDefinition => ({
  binding,
  resource,
  guard: resolveAdminResourceGuard(resource, 'list'),
  path: basePath,
  routeKind: 'list',
  validateSearch: resource.capabilities?.list
    ? (search: Record<string, unknown>) => normalizeAdminResourceListSearch(resource, search)
    : undefined,
});

const createStaticRouteDefinition = (
  resource: AdminResourceDefinition,
  routeKind: Exclude<AdminResourceRouteKind, 'list'>,
  binding: BindingKey,
  path: string
): UiRouteDefinition => ({
  binding,
  resource,
  guard: resolveAdminResourceGuard(resource, routeKind),
  path,
  routeKind,
});
const createHistoryRouteDefinition = (
  resource: AdminResourceDefinition,
  binding: BindingKey | undefined,
  detailPath: string
): readonly UiRouteDefinition[] =>
  binding
    ? [createStaticRouteDefinition(resource, 'history', binding, toAdminHistoryRoutePath(detailPath))]
    : [];

const createAdminResourceRouteDefinitions = (
  bindings: AppRouteBindings,
  resources: readonly AdminResourceDefinition[]
): readonly UiRouteDefinition[] =>
  withCoreContentAdminResource(resources).flatMap((resource) => {
    const resolvedBindings = getAdminResourceBindings(bindings, resource);
    const basePath = toAdminRoutePath(resource.basePath);
    const detailBindingKey = resolveBindingKey(bindings, resource, 'detail', resource.views.detail.bindingKey);
    assertSupportedAdminDetailBinding(detailBindingKey);
    const detailPath = getAdminDetailRoutePath(basePath, detailBindingKey);
    return [
      createListRouteDefinition(resource, resolvedBindings.list, basePath),
      createStaticRouteDefinition(resource, 'create', resolvedBindings.create, toAdminCreateRoutePath(basePath)),
      createStaticRouteDefinition(resource, 'detail', resolvedBindings.detail, detailPath),
      ...createHistoryRouteDefinition(resource, resolvedBindings.history, detailPath),
    ] as const;
  });

export const createAdminResourceRouteFactories = (
  bindings: AppRouteBindings,
  resources: readonly AdminResourceDefinition[],
  diagnostics?: RoutingDiagnosticsHook
): readonly AppRouteFactory[] =>
  createAdminResourceRouteDefinitions(bindings, resources).map(
    (definition) =>
      (rootRoute: RootRoute) => {
        const guard = createAccountUiRouteGuard(definition.guard, diagnostics, definition.path);
        return createRoute({
          getParentRoute: () => rootRoute,
          path: definition.path,
          beforeLoad: async (beforeLoadOptions) => {
            await guard(beforeLoadOptions);
            await ensureAssignedModule(definition.resource, beforeLoadOptions);
            await ensureRequiredPermissions(definition.resource, definition.routeKind, beforeLoadOptions);
          },
          validateSearch: definition.validateSearch,
          component: bindings[definition.binding],
        });
      }
  );

export const createLegacyContentAliasFactories = (
  resources: readonly AdminResourceDefinition[] = []
): readonly AppRouteFactory[] => {
  const canonicalContentPath = resolveCanonicalContentAdminRoutePath(resources);
  const legacyAliases = [
    { aliasPrefix: LEGACY_CONTENT_ALIAS_PREFIX, canonicalPath: canonicalContentPath },
    ...resources
      .filter((resource) => resource.guard === 'content' && resource.basePath !== 'content')
      .map((resource) => ({
        aliasPrefix: `/plugins/${resource.basePath}`,
        canonicalPath: toAdminRoutePath(resource.basePath),
      })),
  ];
  const createLegacyAliasRouteFactory = (aliasPrefix: string, canonicalPath: string, path: string): AppRouteFactory => (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: (options) => {
        const href = readBeforeLoadHref(options);
        throw redirect({
          href:
            aliasPrefix === LEGACY_CONTENT_ALIAS_PREFIX
              ? normalizeLegacyContentHref(href, canonicalPath)
              : normalizeLegacyAdminResourceHref({ href, aliasPrefix, canonicalPath }),
        });
      },
      component: () => null,
    });
  return legacyAliases.flatMap(({ aliasPrefix, canonicalPath }) =>
    [aliasPrefix, toAdminCreateRoutePath(aliasPrefix), `${aliasPrefix}/$contentId`].map((path) =>
      createLegacyAliasRouteFactory(aliasPrefix, canonicalPath, path)
    )
  );
};
