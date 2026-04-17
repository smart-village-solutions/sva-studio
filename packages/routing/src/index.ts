/**
 * Öffentlicher Client-Entry von `@sva/routing`.
 *
 * Exportiert die schlanke kanonische Routing-API für App-Wiring,
 * Pfade und Search-Helfer. Guard- und Plugin-Helfer liegen auf
 * expliziten Subpaths.
 */
export {
  getClientRouteFactories,
  type AppRouteBindings,
  type AppRouteFactory,
} from './app.routes.js';
export { normalizeIamTab, normalizeRoleDetailTab } from './route-search.js';
export { routePaths, uiRoutePaths, type UiRoutePathKey } from './route-paths.js';
export type { RouteGuardUser } from './protected.routes.js';
