import type { AdminResourceDefinition, RouteFactory } from '@sva/plugin-sdk';
import { mergeAdminResourceDefinitions } from '@sva/plugin-sdk';
import { createRoute, type AnyRoute, type RootRoute } from '@tanstack/react-router';

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
  adminResources: readonly AdminResourceDefinition[] = []
): readonly DocumentationPageCatalogEntry[] =>
  [
    ...resolveUiRouteDefinitions(mergeAdminResourceDefinitions(adminResources)),
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
