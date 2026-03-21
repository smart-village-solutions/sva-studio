/**
 * @sva/routing/server - Server-side route definitions & handlers
 * 
 * This module contains server-only routing logic with actual handler implementations.
 * Import this ONLY in .server.tsx files.
 */

export {
  authServerRouteFactories,
  authRoutePaths,
  dispatchAuthRouteRequest,
  resolveAuthRoutePathForRequestPath,
} from './auth.routes.server.js';
export { coreRouteFactories } from './core.routes.js';
