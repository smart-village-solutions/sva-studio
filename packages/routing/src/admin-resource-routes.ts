import type { AdminResourceDefinition } from '@sva/sdk';
import { createRoute, redirect, type RootRoute } from '@tanstack/react-router';

import { createAccountUiRouteGuard, type AccountUiRouteGuardKey } from './account-ui.routes.js';
import type { AppRouteBindings, AppRouteFactory } from './app.routes.shared.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { uiRoutePaths } from './route-paths.js';

type BindingKey = keyof AppRouteBindings;

type UiRouteDefinition = {
  readonly binding: BindingKey;
  readonly guard: AccountUiRouteGuardKey;
  readonly path: string;
};

type AdminResourceBindingResolver = {
  readonly list: BindingKey;
  readonly create: BindingKey;
  readonly detail: BindingKey;
  readonly history?: BindingKey;
};

type AdminResourceRouteKind = 'list' | 'create' | 'detail' | 'history';

const LEGACY_CONTENT_ALIAS_PREFIX = '/content';

const toAdminRoutePath = (basePath: string) => `/admin/${basePath}` as const;

const getAdminResourceBindings = (resource: AdminResourceDefinition): AdminResourceBindingResolver => ({
  list: resource.views.list.bindingKey as BindingKey,
  create: resource.views.create.bindingKey as BindingKey,
  detail: resource.views.detail.bindingKey as BindingKey,
  history: resource.views.history?.bindingKey as BindingKey | undefined,
});

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

export const createAdminResourceRouteFactories = (
  bindings: AppRouteBindings,
  resources: readonly AdminResourceDefinition[],
  diagnostics?: RoutingDiagnosticsHook
): readonly AppRouteFactory[] =>
  createAdminResourceRouteDefinitions(resources).map(
    (definition) =>
      (rootRoute: RootRoute) => {
        const guard = createAccountUiRouteGuard(definition.guard, diagnostics, definition.path);

        return createRoute({
          getParentRoute: () => rootRoute,
          path: definition.path,
          beforeLoad: (beforeLoadOptions) => guard(beforeLoadOptions),
          component: bindings[definition.binding],
        });
      }
  );

export const createLegacyContentAliasFactories = (): readonly AppRouteFactory[] => {
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
