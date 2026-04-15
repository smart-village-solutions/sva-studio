/**
 * Öffentlicher Server-Entry von `@sva/routing/server`.
 *
 * Exportiert serverseitige Route-Factories und Auth-Handler sowie die
 * kanonischen Routing-Helfer für SSR- und Runtime-Integration.
 */
export {
  authServerRouteFactories,
  authRoutePaths,
  dispatchAuthRouteRequest,
  resolveAuthRoutePathForRequestPath,
} from './auth.routes.server.js';
export {
  getPluginRouteFactories,
  getServerRouteFactories,
  mapPluginGuardToAccountGuard,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.js';
export { normalizeIamTab, normalizeRoleDetailTab } from './route-search.js';
export { routePaths, uiRoutePaths, type UiRoutePathKey } from './route-paths.js';
