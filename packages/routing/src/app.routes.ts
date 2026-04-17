import type { PluginDefinition } from '@sva/sdk';

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
  plugins = [],
}: {
  readonly bindings: AppRouteBindings;
  readonly plugins?: readonly PluginDefinition[];
}): readonly AppRouteFactory[] => [
  ...createUiRouteFactories(bindings),
  ...authRouteFactories,
  ...getPluginRouteFactories(plugins),
] as const;
