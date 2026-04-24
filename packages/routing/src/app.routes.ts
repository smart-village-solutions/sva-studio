import type { AdminResourceDefinition, PluginDefinition } from '@sva/plugin-sdk';

import { authRouteFactories } from './auth.routes.js';
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

export const getClientRouteFactories = ({
  bindings,
  adminResources = [],
  plugins = [],
  diagnostics,
}: {
  readonly bindings: AppRouteBindings;
  readonly adminResources?: readonly AdminResourceDefinition[];
  readonly plugins?: readonly PluginDefinition[];
  readonly diagnostics?: import('./diagnostics.js').RoutingDiagnosticsHook;
}): readonly AppRouteFactory[] => [
  ...createUiRouteFactories(bindings, { adminResources, diagnostics }),
  ...authRouteFactories,
  ...getPluginRouteFactories(plugins, { diagnostics }),
] as const;
