import type { PluginDefinition } from '@sva/plugin-sdk';

import { createAccountUiRouteGuard } from './account-ui.routes.js';
import { createProtectedRoute } from './protected.routes.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { mapPluginGuardToAccountGuard } from './app.routes.shared.js';

const isPluginPermissionGuard = (guard: string): boolean =>
  /^[a-z][a-z0-9-]{1,30}\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guard) && guard.startsWith('content.') === false;

const hasRegisteredPluginPermissionGuard = (pluginDefinition: PluginDefinition, guard: string): boolean =>
  pluginDefinition.permissions?.some((permission) => permission.id.trim() === guard) === true;

export const resolvePluginRouteGuard = (
  pluginDefinition: PluginDefinition,
  routeDefinition: PluginDefinition['routes'][number],
  diagnostics: RoutingDiagnosticsHook | undefined
) => {
  const normalizedGuard = routeDefinition.guard?.trim();
  const guardKey = mapPluginGuardToAccountGuard(normalizedGuard);
  if (guardKey) {
    return createAccountUiRouteGuard(guardKey, diagnostics, routeDefinition.path);
  }

  const pluginPermissionGuard = normalizedGuard;
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
