import { createAdminRoute, createProtectedRoute } from './protected.routes';

export const accountUiRoutePaths = {
  account: '/account',
  accountPrivacy: '/account/privacy',
  adminUsers: '/admin/users',
  adminUserDetail: '/admin/users/$userId',
  adminOrganizations: '/admin/organizations',
  adminRoles: '/admin/roles',
  adminGroups: '/admin/groups',
  adminIam: '/admin/iam',
} as const;

export const accountUiRouteGuards = {
  account: createProtectedRoute(),
  accountPrivacy: createProtectedRoute(),
  adminUsers: createAdminRoute(),
  adminUserDetail: createAdminRoute(),
  adminOrganizations: createAdminRoute(),
  adminRoles: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminGroups: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminIam: createProtectedRoute({
    requiredRoles: ['iam_admin', 'support_admin', 'system_admin', 'security_admin', 'compliance_officer'],
  }),
} as const;

export type AccountUiRouteKey = keyof typeof accountUiRoutePaths;
