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
export { getServerRouteFactories } from './app.routes.server.js';
export type { AppRouteBindings, AppRouteFactory } from './app.routes.shared.js';
export { collectDocumentationPageCatalog } from './documentation-page-catalog.js';
export {
  resolveActiveRouteDocumentation,
  type DocumentationPageCatalog,
  type DocumentationPageCatalogEntry,
  type DocumentationPageCatalogOwner,
} from './route-documentation.js';
export type { RouteDocumentation } from '@sva/plugin-sdk';
export { normalizeIamTab, normalizeRoleDetailTab } from './route-search.js';
export { routePaths, uiRoutePaths, type UiRoutePathKey } from './route-paths.js';
