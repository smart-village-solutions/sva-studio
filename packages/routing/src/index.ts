/**
 * @sva/routing - Centralized route registry for SVA applications
 * 
 * This package provides a single source of truth for all application routes,
 * making it easy to compose routes from multiple sources (auth, data, plugins, etc.)
 */

export { authRouteFactories, authRoutePaths } from './auth.routes';

/**
 * Core route factories - all routes that should be registered in all SVA apps
 */
export const coreRouteFactories = [
  // Auth routes
  ...(() => {
    const { authRouteFactories } = require('./auth.routes');
    return authRouteFactories;
  })(),

  // Additional core routes can be added here as the app grows:
  // - Data routes
  // - Admin routes
  // - Public routes
  // etc.
];
