/**
 * Öffentlicher Client-Entry von `@sva/routing`.
 *
 * Exportiert die schlanke kanonische Routing-API für App-Wiring,
 * Pfade und Search-Helfer. Guard- und Plugin-Helfer liegen auf
 * expliziten Subpaths.
 */
export {
  getClientRouteFactories,
} from './app.routes.js';
export type { AppRouteBindings, AppRouteFactory } from './app.routes.shared.js';
export { normalizeIamTab, normalizeRoleDetailTab } from './route-search.js';
export { routePaths, uiRoutePaths, type UiRoutePathKey } from './route-paths.js';
export type { RouteGuardUser } from './protected.routes.js';
export type { RoutingDiagnosticEvent, RoutingDiagnosticsHook, RoutingDenyReason } from './diagnostics.js';
