import { authRouteFactories } from './auth.routes';

/**
 * Core route factories - all routes that should be registered in all SVA apps
 * 
 * This aggregates routes from various sources and exports them as a single array
 * for easy consumption in app route configurations.
 */
export const coreRouteFactories = [
  // Auth routes (from @sva/auth)
  ...authRouteFactories,

  // Additional core routes can be added here as the app grows:
  // - Data routes
  // - Admin routes  
  // - Public routes
  // etc.
];
