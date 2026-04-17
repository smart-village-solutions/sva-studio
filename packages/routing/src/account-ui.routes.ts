import { createAdminRoute, createProtectedRoute } from './protected.routes.js';

export const accountUiRouteGuards = {
  account: createProtectedRoute(),
  accountPrivacy: createProtectedRoute(),
  content: createProtectedRoute(),
  contentCreate: createProtectedRoute(),
  contentDetail: createProtectedRoute(),
  adminUsers: createAdminRoute(),
  adminUserCreate: createAdminRoute(),
  adminUserDetail: createAdminRoute(),
  adminOrganizations: createAdminRoute(),
  adminOrganizationCreate: createAdminRoute(),
  adminOrganizationDetail: createAdminRoute(),
  adminInstances: createProtectedRoute({ requiredRoles: ['instance_registry_admin'] }),
  adminRoles: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminRoleDetail: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminGroups: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminGroupCreate: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminGroupDetail: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminLegalTexts: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminLegalTextCreate: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminLegalTextDetail: createProtectedRoute({ requiredRoles: ['system_admin'] }),
  adminIam: createProtectedRoute({
    requiredRoles: ['iam_admin', 'support_admin', 'system_admin', 'security_admin', 'compliance_officer'],
  }),
} as const;
