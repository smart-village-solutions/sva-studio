/**
 * @sva/routing - Centralized route registry for SVA applications
 * 
 * This package provides a single source of truth for all application routes,
 * making it easy to compose routes from multiple sources (auth, data, plugins, etc.)
 */

export { authRouteFactories, authRoutePaths } from './auth.routes';
export { accountUiRouteGuards, accountUiRoutePaths, type AccountUiRouteKey } from './account-ui.routes';
export { coreRouteFactories } from './core.routes';
export { createAdminRoute, createProtectedRoute } from './protected.routes';
export type { ProtectedRouteOptions, RouteGuardContext, RouteGuardUser } from './protected.routes';
