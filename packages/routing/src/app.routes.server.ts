import type { PluginDefinition } from '@sva/sdk';

import { authServerRouteFactories } from './auth.routes.server.js';
import {
  createUiRouteFactories,
  getPluginRouteFactories,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.shared.js';

export {
  getPluginRouteFactories,
  mapPluginGuardToAccountGuard,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.shared.js';

export const getServerRouteFactories = ({
  bindings,
  plugins = [],
  diagnostics,
}: {
  readonly bindings: AppRouteBindings;
  readonly plugins?: readonly PluginDefinition[];
  readonly diagnostics?: import('./diagnostics.js').RoutingDiagnosticsHook;
}): readonly AppRouteFactory[] => [
  ...createUiRouteFactories(bindings, { diagnostics }),
  ...authServerRouteFactories,
  ...getPluginRouteFactories(plugins, { diagnostics }),
] as const;
