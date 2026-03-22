/**
 * @sva/routing - Centralized route registry for SVA applications
 * 
 * This package provides a single source of truth for all application routes,
 * making it easy to compose routes from multiple sources (auth, data, plugins, etc.)
 */

export { authRouteFactories, authRoutePaths } from './auth.routes.js';
export { accountUiRouteGuards, accountUiRoutePaths, type AccountUiRouteKey } from './account-ui.routes.js';
export { coreRouteFactories } from './core.routes.js';
export { createAdminRoute, createProtectedRoute } from './protected.routes.js';
export type { ProtectedRouteOptions, RouteGuardContext, RouteGuardUser } from './protected.routes.js';
