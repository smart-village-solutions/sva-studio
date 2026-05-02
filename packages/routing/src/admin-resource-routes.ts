import type { AdminResourceDefinition } from '@sva/plugin-sdk';
import { createRoute, redirect, type RootRoute } from '@tanstack/react-router';

import {
  LEGACY_CONTENT_ALIAS_PREFIX,
  coreContentAdminResource,
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
type AdminResourceBindingResolver = {
  readonly list: BindingKey;
  readonly create: BindingKey;
  readonly detail: BindingKey;
  readonly history?: BindingKey;
};
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
  user: { assignedModules?: readonly string[] } | null | undefined
): Promise<void> => {
  if (!resource.moduleId) {
    return;
  }

  if (!user?.assignedModules?.includes(resource.moduleId)) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};

const ensureRequiredPermissions = async (
  resource: AdminResourceDefinition,
  routeKind: AdminResourceRouteKind,
  user: { permissionActions?: readonly string[] } | null | undefined
): Promise<void> => {
  const requiredPermissions = resource.permissions?.[routeKind];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return;
  }

  const grantedPermissions = new Set(user?.permissionActions ?? []);
  if (requiredPermissions.some((permission) => !grantedPermissions.has(permission))) {
    throw redirect({ href: '/?error=auth.insufficientRole' });
  }
};

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
      {
        binding: resolvedBindings.list,
        resource,
        guard: resolveAdminResourceGuard(resource, 'list'),
        path: basePath,
        routeKind: 'list',
        validateSearch: resource.capabilities?.list
          ? (search: Record<string, unknown>) => normalizeAdminResourceListSearch(resource, search)
          : undefined,
      },
      {
        binding: resolvedBindings.create,
        resource,
        guard: resolveAdminResourceGuard(resource, 'create'),
        path: toAdminCreateRoutePath(basePath),
        routeKind: 'create',
      },
      {
        binding: resolvedBindings.detail,
        resource,
        guard: resolveAdminResourceGuard(resource, 'detail'),
        path: detailPath,
        routeKind: 'detail',
      },
      ...(resolvedBindings.history
        ? [
            {
              binding: resolvedBindings.history,
              resource,
              guard: resolveAdminResourceGuard(resource, 'history'),
              path: toAdminHistoryRoutePath(detailPath),
              routeKind: 'history',
            } satisfies UiRouteDefinition,
          ]
        : []),
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
            let cachedUserPromise: Promise<
              | {
                  assignedModules?: readonly string[];
                  permissionActions?: readonly string[];
                }
              | null
              | undefined
            > | null = null;
            const getUser = async () => {
              cachedUserPromise ??= Promise.resolve(beforeLoadOptions.context?.auth?.getUser?.());
              return await cachedUserPromise;
            };
            const memoizedBeforeLoadOptions = {
              ...beforeLoadOptions,
              context: {
                ...beforeLoadOptions.context,
                auth: beforeLoadOptions.context?.auth
                  ? {
                      ...beforeLoadOptions.context.auth,
                      getUser,
                    }
                  : {
                      getUser,
                    },
              },
            };

            await guard(memoizedBeforeLoadOptions);
            const user = await getUser();
            await ensureAssignedModule(definition.resource, user);
            await ensureRequiredPermissions(definition.resource, definition.routeKind, user);
          },
          validateSearch: definition.validateSearch,
          component: bindings[definition.binding],
        });
      }
  );

export const createLegacyContentAliasFactories = (
  resources: readonly AdminResourceDefinition[] = []
): readonly AppRouteFactory[] => {
  const pluginContentAliasResources = resources.filter(
    (resource) => resource.guard === 'content' && resource.contentUi && resource.basePath !== coreContentAdminResource.basePath
  );
  const aliasPaths = [LEGACY_CONTENT_ALIAS_PREFIX, toAdminCreateRoutePath(LEGACY_CONTENT_ALIAS_PREFIX), '/content/$contentId'] as const;
  const canonicalContentPath = resolveCanonicalContentAdminRoutePath(resources);
  const pluginCrudAliasDefinitions = pluginContentAliasResources.flatMap((resource) => {
    const pluginAliasPrefix = `/plugins/${resource.basePath}`;
    const canonicalAdminPath = toAdminRoutePath(resource.basePath);

    return [
      { aliasPath: pluginAliasPrefix, canonicalPath: canonicalAdminPath },
      { aliasPath: `${pluginAliasPrefix}/new`, canonicalPath: `${canonicalAdminPath}/new` },
      {
        aliasPath: `${pluginAliasPrefix}/$contentId`,
        canonicalPath: canonicalAdminPath,
        dynamicPrefix: `${pluginAliasPrefix}/`,
      },
    ] as const;
  });

  return [
    ...aliasPaths.map((path) => ({
      path,
      resolveHref: (href: string) => normalizeLegacyContentHref(href, canonicalContentPath),
    })),
    ...pluginCrudAliasDefinitions.map((definition) => ({
      path: definition.aliasPath,
      resolveHref: (href: string) =>
        href === definition.aliasPath || href.startsWith(`${definition.aliasPath}?`)
          ? href.replace(definition.aliasPath, definition.canonicalPath)
          : href === `${definition.aliasPath}/new` || href.startsWith(`${definition.aliasPath}/new?`)
            ? href.replace(`${definition.aliasPath}/new`, `${definition.canonicalPath}/new`)
            : 'dynamicPrefix' in definition && href.startsWith(definition.dynamicPrefix)
              ? href.replace(definition.dynamicPrefix, `${definition.canonicalPath}/`)
            : href.startsWith(`${definition.aliasPath}/`)
              ? href.replace(`${definition.aliasPath}/`, `${definition.canonicalPath}/`)
              : definition.canonicalPath,
    })),
  ].map(({ path, resolveHref }) => (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: (options) => {
        throw redirect({ href: resolveHref(readBeforeLoadHref(options)) });
      },
      component: () => null,
    })
  );
};
