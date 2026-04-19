import { createBrowserLogger, type PluginDefinition } from '@sva/sdk';

import { authRouteFactories } from './auth.routes.js';
import {
  createUiRouteFactories,
  getPluginRouteFactories,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.shared.js';
import { createRoutingDiagnosticsLogger } from './diagnostics.js';

export {
  getPluginRouteFactories,
  mapPluginGuardToAccountGuard,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.shared.js';

const defaultClientRoutingDiagnostics = createRoutingDiagnosticsLogger(
  createBrowserLogger({ component: 'routing', level: 'info' })
);

export const getClientRouteFactories = ({
  bindings,
  plugins = [],
  diagnostics,
}: {
  readonly bindings: AppRouteBindings;
  readonly plugins?: readonly PluginDefinition[];
  readonly diagnostics?: import('./diagnostics.js').RoutingDiagnosticsHook;
}): readonly AppRouteFactory[] => [
  ...createUiRouteFactories(bindings, { diagnostics: diagnostics ?? defaultClientRoutingDiagnostics }),
  ...authRouteFactories,
  ...getPluginRouteFactories(plugins, { diagnostics: diagnostics ?? defaultClientRoutingDiagnostics }),
] as const;
