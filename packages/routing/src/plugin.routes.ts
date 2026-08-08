import type { PluginDefinition, RouteFactory } from '@sva/plugin-sdk';
import { assertPluginRoutePathAllowed, createPluginGuardrailError } from '@sva/plugin-sdk';
import { createRoute, redirect, type AnyRoute, type RootRoute } from '@tanstack/react-router';

import type { AppRouteBindings } from './app-route-bindings.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { resolvePluginRouteGuard } from './plugin-route-guards.js';
import type { RouteGuardContext } from './protected.routes.js';
import { enforcePluginRouteAccessRequirement } from './ui-route-access.js';

type PluginRouteFactory = RouteFactory<RootRoute, AnyRoute>;

export const getPluginRouteFactories = (
  pluginDefinitions: readonly PluginDefinition[] = [],
  options: { readonly diagnostics?: RoutingDiagnosticsHook } = {}
): readonly PluginRouteFactory[] => {
  const diagnostics = options.diagnostics;
  return pluginDefinitions.flatMap((pluginDefinition) =>
    pluginDefinition.routes.map((routeDefinition) => {
      const guard = resolvePluginRouteGuard(pluginDefinition, routeDefinition, diagnostics);
      const normalizedGuard = routeDefinition.guard?.trim();
      const unsupportedGuard = !guard && normalizedGuard ? normalizedGuard : null;
      const pluginNamespace = pluginDefinition.id.trim();
      const contributionId = routeDefinition.id.trim();
      const requiredModuleId = pluginDefinition.moduleIam?.moduleId?.trim() || null;
      const accessRequirementCoversModule =
        routeDefinition.accessRequirement?.kind === 'tenant' &&
        routeDefinition.accessRequirement.moduleId === requiredModuleId;

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
          validateSearch: routeDefinition.validateSearch,
          beforeLoad: async (beforeLoadOptions) => {
            if (routeDefinition.accessRequirement) {
              await enforcePluginRouteAccessRequirement(routeDefinition.accessRequirement, {
                context: beforeLoadOptions.context as RouteGuardContext,
              });
            } else {
              await guard?.(beforeLoadOptions);
            }

            if (!requiredModuleId || accessRequirementCoversModule) {
              return;
            }

            const user = await beforeLoadOptions.context.auth?.getUser();
            if (!user?.assignedModules?.includes(requiredModuleId)) {
              throw redirect({ href: '/?error=auth.insufficientRole' });
            }
          },
          component: routeDefinition.component as AppRouteBindings[keyof AppRouteBindings],
        });
    })
  );
};
