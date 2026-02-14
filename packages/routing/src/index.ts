/**
 * @sva/routing - Centralized route registry for SVA applications
 * 
 * This package provides a single source of truth for all application routes,
 * making it easy to compose routes from multiple sources (auth, data, plugins, etc.)
 */

export { authRouteFactories, authRoutePaths } from './auth.routes';
export { coreRouteFactories } from './core.routes';

