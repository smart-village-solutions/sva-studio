/**
 * Öffentlicher Client-Entry von `@sva/routing`.
 *
 * Exportiert die kanonische Routing-API für UI-Routen, Plugin-Routen,
 * Guard-Typen und zentrale Pfad-/Search-Helfer.
 */
export { authRoutePaths } from './auth.routes.js';
export {
  getClientRouteFactories,
  getPluginRouteFactories,
  mapPluginGuardToAccountGuard,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.js';
export { accountUiRouteGuards } from './account-ui.routes.js';
export { createAdminRoute, createProtectedRoute } from './protected.routes.js';
export { normalizeIamTab, normalizeRoleDetailTab } from './route-search.js';
export { routePaths, uiRoutePaths, type UiRoutePathKey } from './route-paths.js';
export type { ProtectedRouteOptions, RouteGuardContext, RouteGuardUser } from './protected.routes.js';
