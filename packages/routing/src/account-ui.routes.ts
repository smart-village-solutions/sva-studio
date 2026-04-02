import { createAdminRoute, createProtectedRoute } from './protected.routes.js';

export const accountUiRoutePaths = {
  account: '/account',
  accountPrivacy: '/account/privacy',
  content: '/content',
  contentCreate: '/content/new',
  contentDetail: '/content/$contentId',
  adminUsers: '/admin/users',
  adminUserDetail: '/admin/users/$userId',
  adminOrganizations: '/admin/organizations',
  adminInstances: '/admin/instances',
  adminRoles: '/admin/roles',
  adminRoleDetail: '/admin/roles/$roleId',
  adminGroups: '/admin/groups',
  adminIam: '/admin/iam',
} as const;

export const accountUiRouteGuards = {
  account: createProtectedRoute(),
  accountPrivacy: createProtectedRoute(),
  content: createProtectedRoute({ requiredRoles: ['system_admin', 'app_manager', 'editor'] }),
  contentCreate: createProtectedRoute({ requiredRoles: ['system_admin', 'app_manager', 'editor'] }),
  contentDetail: createProtectedRoute({ requiredRoles: ['system_admin', 'app_manager', 'editor'] }),
  adminUsers: createAdminRoute(),
  adminUserDetail: createAdminRoute(),
  adminOrganizations: createAdminRoute(),
  adminInstances: createProtectedRoute({ requiredRoles: ['instance_registry_admin'] }),
  adminRoles: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminRoleDetail: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminGroups: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminIam: createProtectedRoute({
    requiredRoles: ['iam_admin', 'support_admin', 'system_admin', 'security_admin', 'compliance_officer'],
  }),
} as const;

export type AccountUiRouteKey = keyof typeof accountUiRoutePaths;
