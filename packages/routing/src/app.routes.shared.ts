import type { AdminResourceDefinition, PluginDefinition, RouteFactory } from '@sva/plugin-sdk';
import { mergeAdminResourceDefinitions } from '@sva/plugin-sdk';
import { createRoute, type AnyRoute, type RootRoute } from '@tanstack/react-router';
import type { RouteComponent } from '@tanstack/react-router';

import {
  assertNoStaticAdminRouteShadowing,
  collectAdminResourceRoutePaths,
} from './admin-resource-route-conflicts.js';
import type { AppRouteBindings } from './app-route-bindings.js';
import { adminUiRouteDefinitions } from './app-admin-route-definitions.js';
import {
  additionalUiRouteDefinitions,
  standardUiRouteDefinitions,
  type UiRouteDefinition,
} from './app-route-definitions.js';
import { createAccountUiRouteGuard } from './account-ui.routes.js';
import {
  collectLegacyContentAliasDefinitions,
  createAdminResourceRouteFactories,
  createLegacyContentAliasFactories,
} from './admin-resource-routes.js';
import { type RoutingDiagnosticsHook } from './diagnostics.js';
export { mapPluginGuardToAccountGuard } from './plugin-guard-mapping.js';
import type { RouteGuardContext } from './protected.routes.js';
import { enforceUiRouteAccessRequirements } from './ui-route-access.js';
import {
  toDocumentationPageCatalogEntry,
  type DocumentationPageCatalogEntry,
} from './route-documentation.js';

export { getAdminDetailRoutePath } from './admin-resource-route-paths.js';
export { getPluginRouteFactories } from './plugin.routes.js';
export type { AppRouteBindings } from './app-route-bindings.js';

export const mergePluginViewBindings = (
  bindings: AppRouteBindings,
  plugins: readonly PluginDefinition[]
): AppRouteBindings => {
  const contributedViews = new Map<string, RouteComponent>();
  for (const plugin of plugins) {
    for (const view of plugin.viewBindings ?? []) {
      if (contributedViews.has(view.bindingKey)) {
        throw new Error(`plugin_view_binding_collision:${view.bindingKey}`);
      }
      const hostBinding = (bindings as unknown as Readonly<Record<string, RouteComponent>>)[
        view.bindingKey
      ];
      if (hostBinding && hostBinding !== view.component) {
        throw new Error(`plugin_view_binding_host_collision:${view.bindingKey}`);
      }
      contributedViews.set(view.bindingKey, view.component as RouteComponent);
    }
  }
  return new Proxy(bindings, {
    get: (target, key, receiver) =>
      typeof key === 'string' && contributedViews.has(key)
        ? contributedViews.get(key)
        : Reflect.get(target, key, receiver),
    getOwnPropertyDescriptor: (target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (descriptor || typeof key !== 'string' || !contributedViews.has(key)) {
        return descriptor;
      }
      return {
        configurable: true,
        enumerable: true,
        value: contributedViews.get(key),
        writable: false,
      };
    },
    has: (target, key) =>
      (typeof key === 'string' && contributedViews.has(key)) || Reflect.has(target, key),
    ownKeys: (target) =>
      Array.from(new Set([...Reflect.ownKeys(target), ...contributedViews.keys()])),
  }) as AppRouteBindings;
};

export const assertPluginContentUiBindings = (
  bindings: AppRouteBindings,
  plugins: readonly PluginDefinition[]
): void => {
  for (const plugin of plugins) {
    for (const resource of plugin.adminResources ?? []) {
      for (const [viewName, view] of Object.entries(resource.contentUi?.bindings ?? {})) {
        if (!Object.prototype.hasOwnProperty.call(bindings, view.bindingKey)) {
          throw new Error(
            `unknown_admin_resource_binding_key:${resource.resourceId}:contentUi.${viewName}:${view.bindingKey}`
          );
        }
      }
    }
  }
};

export type AppRouteFactory = RouteFactory<RootRoute, AnyRoute>;
export type { AppRouteBindingKey } from './app-route-definitions.js';

const uiRouteDefinitions: readonly UiRouteDefinition[] = [
  ...standardUiRouteDefinitions,
  ...adminUiRouteDefinitions,
  ...additionalUiRouteDefinitions,
];

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
  adminResources: readonly AdminResourceDefinition[] = [],
  bindings?: AppRouteBindings
): readonly DocumentationPageCatalogEntry[] =>
  [
    ...resolveUiRouteDefinitions(mergeAdminResourceDefinitions(adminResources)).filter(
      (definition) =>
        !bindings || Object.prototype.hasOwnProperty.call(bindings, definition.binding)
    ),
    ...collectLegacyContentAliasDefinitions(adminResources),
  ].flatMap((definition) => {
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
  const routeDefinitions = resolveUiRouteDefinitions(adminResources).filter((definition) =>
    Object.prototype.hasOwnProperty.call(bindings, definition.binding)
  );
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
            component: (bindings as unknown as Readonly<Record<string, RouteComponent>>)[
              definition.binding
            ],
          });
      }

      return (rootRoute: RootRoute) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: definition.path,
          staticData: { documentation: definition.documentation },
          validateSearch: definition.validateSearch,
          component: (bindings as unknown as Readonly<Record<string, RouteComponent>>)[
            definition.binding
          ],
        });
    }),
    ...createAdminResourceRouteFactories(bindings, adminResources, diagnostics),
    ...createLegacyContentAliasFactories(adminResources),
  ];
};
