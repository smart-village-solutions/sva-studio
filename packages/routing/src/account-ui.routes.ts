import { createAdminRoute, createProtectedRoute } from './protected.routes';

export const accountUiRoutePaths = {
  account: '/account',
  adminUsers: '/admin/users',
  adminUserDetail: '/admin/users/$userId',
  adminOrganizations: '/admin/organizations',
  adminRoles: '/admin/roles',
} as const;

export const accountUiRouteGuards = {
  account: createProtectedRoute(),
  adminUsers: createAdminRoute(),
  adminUserDetail: createAdminRoute(),
  adminOrganizations: createAdminRoute(),
  adminRoles: createProtectedRoute({ requiredRoles: ['system_admin'] }),
} as const;

export type AccountUiRouteKey = keyof typeof accountUiRoutePaths;
