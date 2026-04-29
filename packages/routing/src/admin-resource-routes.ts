import type { AdminResourceDefinition } from '@sva/plugin-sdk';
import { createRoute, redirect, type RootRoute } from '@tanstack/react-router';

import { createAccountUiRouteGuard, type AccountUiRouteGuardKey } from './account-ui.routes.js';
import { normalizeAdminResourceListSearch } from './admin-resource-search-params.js';
import type { AppRouteBindings, AppRouteFactory } from './app.routes.shared.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';

type BindingKey = keyof AppRouteBindings;

type UiRouteDefinition = {
  readonly binding: BindingKey;
  readonly guard: AccountUiRouteGuardKey;
  readonly path: string;
  readonly validateSearch?: (search: Record<string, unknown>) => unknown;
};

type AdminResourceBindingResolver = { readonly list: BindingKey; readonly create: BindingKey; readonly detail: BindingKey; readonly history?: BindingKey };

type AdminResourceRouteKind = 'list' | 'create' | 'detail' | 'history';
type AdminResourceViewKind = keyof AdminResourceDefinition['views'];
type DetailBindingKey = Extract<BindingKey, 'contentDetail' | 'adminUserDetail' | 'adminOrganizationDetail' | 'adminInstanceDetail' | 'adminRoleDetail' | 'adminGroupDetail' | 'adminLegalTextDetail'>;

const LEGACY_CONTENT_ALIAS_PREFIX = '/content';

const coreContentAdminResource = {
  resourceId: 'content',
  basePath: 'content',
  titleKey: 'content.page.title',
  guard: 'content',
  views: {
    list: { bindingKey: 'content' },
    create: { bindingKey: 'contentCreate' },
    detail: { bindingKey: 'contentDetail' },
  },
} as const satisfies AdminResourceDefinition;

const toAdminRoutePath = (basePath: string) => `/admin/${basePath}` as const;
const toAdminCreateRoutePath = (basePath: string) => `${basePath}/new`;
const toAdminHistoryRoutePath = (detailPath: string) => `${detailPath}/history`;

export const adminDetailParamNameByBinding = {
  contentDetail: 'id',
  adminUserDetail: 'userId',
  adminOrganizationDetail: 'organizationId',
  adminInstanceDetail: 'instanceId',
  adminRoleDetail: 'roleId',
  adminGroupDetail: 'groupId',
  adminLegalTextDetail: 'legalTextVersionId',
} as const satisfies Record<DetailBindingKey, string>;

const hasBindingKey = (bindings: AppRouteBindings, bindingKey: string): bindingKey is BindingKey =>
  Object.prototype.hasOwnProperty.call(bindings, bindingKey);

const resolveBindingKey = (bindings: AppRouteBindings, resource: AdminResourceDefinition, viewName: AdminResourceViewKind, bindingKey: string | undefined): BindingKey => {
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

const getDetailParamName = (bindingKey: BindingKey): string => {
  if (!Object.prototype.hasOwnProperty.call(adminDetailParamNameByBinding, bindingKey)) {
    throw new Error(`unsupported_admin_resource_detail_binding:${bindingKey}`);
  }
  return adminDetailParamNameByBinding[bindingKey as DetailBindingKey];
};

const withCoreContentAdminResource = (resources: readonly AdminResourceDefinition[]): readonly AdminResourceDefinition[] => {
  const containsCoreContent = resources.some(
    (resource) =>
      resource.resourceId === coreContentAdminResource.resourceId || resource.basePath === coreContentAdminResource.basePath
  );
  if (containsCoreContent) {
    return resources;
  }
  return [coreContentAdminResource, ...resources];
};

const resolveCanonicalContentAdminRoutePath = (resources: readonly AdminResourceDefinition[]): string => {
  const contentResource = withCoreContentAdminResource(resources).find((resource) => resource.resourceId === coreContentAdminResource.resourceId);

  return toAdminRoutePath(contentResource?.basePath ?? coreContentAdminResource.basePath);
};

const adminResourceGuardMap = {
  content: {
    list: 'content',
    create: 'contentCreate',
    detail: 'contentDetail',
    history: 'content',
  },
  adminUsers: {
    list: 'adminUsers',
    create: 'adminUserCreate',
    detail: 'adminUserDetail',
    history: 'adminUsers',
  },
  adminOrganizations: {
    list: 'adminOrganizations',
    create: 'adminOrganizationCreate',
    detail: 'adminOrganizationDetail',
    history: 'adminOrganizations',
  },
  adminInstances: {
    list: 'adminInstances',
    create: 'adminInstances',
    detail: 'adminInstances',
    history: 'adminInstances',
  },
  adminRoles: {
    list: 'adminRoles',
    create: 'adminRoles',
    detail: 'adminRoleDetail',
    history: 'adminRoles',
  },
  adminGroups: {
    list: 'adminGroups',
    create: 'adminGroupCreate',
    detail: 'adminGroupDetail',
    history: 'adminGroups',
  },
  adminLegalTexts: {
    list: 'adminLegalTexts',
    create: 'adminLegalTextCreate',
    detail: 'adminLegalTextDetail',
    history: 'adminLegalTexts',
  },
} as const satisfies Record<
  AdminResourceDefinition['guard'],
  Record<AdminResourceRouteKind, AccountUiRouteGuardKey>
>;

const resolveAdminResourceGuard = (
  resource: AdminResourceDefinition,
  routeKind: AdminResourceRouteKind
): AccountUiRouteGuardKey => adminResourceGuardMap[resource.guard][routeKind];

const createAdminResourceRouteDefinitions = (
  bindings: AppRouteBindings,
  resources: readonly AdminResourceDefinition[]
): readonly UiRouteDefinition[] =>
  withCoreContentAdminResource(resources).flatMap((resource) => {
    const resolvedBindings = getAdminResourceBindings(bindings, resource);
    const basePath = toAdminRoutePath(resource.basePath);
    const detailBindingKey = resolveBindingKey(bindings, resource, 'detail', resource.views.detail.bindingKey);
    const detailParamName = getDetailParamName(detailBindingKey);
    const detailPath = `${basePath}/$${detailParamName}`;

    return [
      {
        binding: resolvedBindings.list,
        guard: resolveAdminResourceGuard(resource, 'list'),
        path: basePath,
        validateSearch: resource.capabilities?.list
          ? (search: Record<string, unknown>) => normalizeAdminResourceListSearch(resource, search)
          : undefined,
      },
      {
        binding: resolvedBindings.create,
        guard: resolveAdminResourceGuard(resource, 'create'),
        path: toAdminCreateRoutePath(basePath),
      },
      {
        binding: resolvedBindings.detail,
        guard: resolveAdminResourceGuard(resource, 'detail'),
        path: detailPath,
      },
      ...(resolvedBindings.history
        ? [
            {
              binding: resolvedBindings.history,
              guard: resolveAdminResourceGuard(resource, 'history'),
              path: toAdminHistoryRoutePath(detailPath),
            } satisfies UiRouteDefinition,
          ]
        : []),
    ] as const;
  });

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

const normalizeLegacyContentHref = (href: string, canonicalContentPath: string): string => {
  if (href === LEGACY_CONTENT_ALIAS_PREFIX || href.startsWith(`${LEGACY_CONTENT_ALIAS_PREFIX}?`)) {
    return href.replace(LEGACY_CONTENT_ALIAS_PREFIX, canonicalContentPath);
  }
  if (href === `${LEGACY_CONTENT_ALIAS_PREFIX}/new` || href.startsWith(`${LEGACY_CONTENT_ALIAS_PREFIX}/new?`)) {
    return href.replace(`${LEGACY_CONTENT_ALIAS_PREFIX}/new`, `${canonicalContentPath}/new`);
  }
  if (href.startsWith(`${LEGACY_CONTENT_ALIAS_PREFIX}/`)) {
    return href.replace(`${LEGACY_CONTENT_ALIAS_PREFIX}/`, `${canonicalContentPath}/`);
  }

  return canonicalContentPath;
};

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
          beforeLoad: (beforeLoadOptions) => guard(beforeLoadOptions),
          validateSearch: definition.validateSearch,
          component: bindings[definition.binding],
        });
      }
  );

export const createLegacyContentAliasFactories = (
  resources: readonly AdminResourceDefinition[] = []
): readonly AppRouteFactory[] => {
  const aliasPaths = [LEGACY_CONTENT_ALIAS_PREFIX, toAdminCreateRoutePath(LEGACY_CONTENT_ALIAS_PREFIX), '/content/$contentId'] as const;
  const canonicalContentPath = resolveCanonicalContentAdminRoutePath(resources);

  return aliasPaths.map(
    (path) =>
      (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path,
          beforeLoad: (options) => {
            throw redirect({ href: normalizeLegacyContentHref(readBeforeLoadHref(options), canonicalContentPath) });
          },
          component: () => null,
        })
  );
};
