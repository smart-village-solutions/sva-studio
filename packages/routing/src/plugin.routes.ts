import type { PluginDefinition, RouteFactory } from '@sva/plugin-sdk';
import { assertPluginRoutePathAllowed, createPluginGuardrailError } from '@sva/plugin-sdk';
import { createRoute, redirect, type AnyRoute, type RootRoute } from '@tanstack/react-router';

import type { AppRouteBindings } from './app-route-bindings.js';
import { createMemoizedUserContext } from './admin-resource-authorization.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { resolvePluginRouteGuard } from './plugin-route-guards.js';
import type { RouteGuardContext } from './protected.routes.js';
import { enforceRouteAccessRequirement } from './ui-route-access.js';
import {
  toDocumentationPageCatalogEntry,
  type DocumentationPageCatalogEntry,
} from './route-documentation.js';

type PluginRouteFactory = RouteFactory<RootRoute, AnyRoute>;
export type PluginRouteScope = 'platform' | 'tenant';

const matchesPluginRouteScope = (
  routeDefinition: PluginDefinition['routes'][number],
  scope: PluginRouteScope | undefined
): boolean =>
  scope === undefined ||
  (scope === 'platform'
    ? routeDefinition.accessRequirement?.kind === 'platform'
    : routeDefinition.accessRequirement?.kind !== 'platform');

export const collectPluginRouteDocumentationPages = (
  pluginDefinitions: readonly PluginDefinition[] = []
): readonly DocumentationPageCatalogEntry[] =>
  pluginDefinitions.flatMap((pluginDefinition) =>
    pluginDefinition.routes.flatMap((routeDefinition) => {
      if (!routeDefinition.documentation) {
        throw new Error(
          `plugin_route_documentation_missing:${pluginDefinition.id}:${routeDefinition.id}`
        );
      }
      const entry = toDocumentationPageCatalogEntry({
        documentation: routeDefinition.documentation,
        path: routeDefinition.path,
        owner: { kind: 'plugin', pluginId: pluginDefinition.id },
      });
      return entry ? [entry] : [];
    })
  );

export const getPluginRouteFactories = (
  pluginDefinitions: readonly PluginDefinition[] = [],
  options: {
    readonly diagnostics?: RoutingDiagnosticsHook;
    readonly scope?: PluginRouteScope;
  } = {}
): readonly PluginRouteFactory[] => {
  const diagnostics = options.diagnostics;
  return pluginDefinitions.flatMap((pluginDefinition) =>
    pluginDefinition.routes
      .filter((routeDefinition) => matchesPluginRouteScope(routeDefinition, options.scope))
      .map((routeDefinition) => {
        const guard = resolvePluginRouteGuard(pluginDefinition, routeDefinition, diagnostics);
        const normalizedGuard = routeDefinition.guard?.trim();
        const unsupportedGuard = !guard && normalizedGuard ? normalizedGuard : null;
        const pluginNamespace = pluginDefinition.id.trim();
        const contributionId = routeDefinition.id.trim();
        const requiredModuleId = pluginDefinition.moduleIam?.moduleId?.trim() || null;
        const accessRequirementCoversModule =
          routeDefinition.accessRequirement?.kind === 'tenant' &&
          routeDefinition.accessRequirement.moduleId === requiredModuleId;
        const isPlatformRoute = routeDefinition.accessRequirement?.kind === 'platform';

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
            staticData: { documentation: routeDefinition.documentation },
            validateSearch: routeDefinition.validateSearch,
            beforeLoad: async (beforeLoadOptions) => {
              const userContext = createMemoizedUserContext(beforeLoadOptions);
              if (routeDefinition.accessRequirement) {
                await enforceRouteAccessRequirement(routeDefinition.accessRequirement, {
                  context: userContext.options.context as RouteGuardContext,
                  location: userContext.options.location,
                });
              } else {
                await guard?.(userContext.options);
              }

              if (!requiredModuleId || accessRequirementCoversModule || isPlatformRoute) {
                return;
              }

              const user = await userContext.getUser();
              if (!user?.assignedModules?.includes(requiredModuleId)) {
                throw redirect({ href: '/?error=auth.insufficientRole' });
              }
            },
            component: routeDefinition.component as AppRouteBindings[keyof AppRouteBindings],
          });
      })
  );
};
