import type { AdminResourceDefinition, PluginDefinition } from '@sva/plugin-sdk';
import type { RoutingDiagnosticsHook } from './diagnostics.js';

import { authServerRouteFactories } from './auth.routes.server.js';
import {
  createUiRouteFactories,
  getPluginRouteFactories,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.shared.js';
import { defaultServerRoutingDiagnostics } from './diagnostics.server.js';

export {
  getPluginRouteFactories,
  mapPluginGuardToAccountGuard,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.shared.js';

export const getServerRouteFactories = ({
  bindings,
  adminResources = [],
  plugins = [],
  diagnostics,
  pluginScope,
}: {
  readonly bindings: AppRouteBindings;
  readonly adminResources?: readonly AdminResourceDefinition[];
  readonly plugins?: readonly PluginDefinition[];
  readonly diagnostics?: RoutingDiagnosticsHook;
  readonly pluginScope?: import('./plugin.routes.js').PluginRouteScope;
}): readonly AppRouteFactory[] =>
  [
    ...createUiRouteFactories(bindings, {
      adminResources,
      diagnostics: diagnostics ?? defaultServerRoutingDiagnostics,
    }),
    ...authServerRouteFactories,
    ...getPluginRouteFactories(plugins, {
      diagnostics: diagnostics ?? defaultServerRoutingDiagnostics,
      scope: pluginScope,
    }),
  ] as const;
