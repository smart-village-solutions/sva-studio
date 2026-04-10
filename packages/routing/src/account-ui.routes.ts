import { createAdminRoute, createProtectedRoute } from './protected.routes.js';

export const accountUiRoutePaths = {
  account: '/account',
  accountPrivacy: '/account/privacy',
  content: '/content',
  contentCreate: '/content/new',
  contentDetail: '/content/$contentId',
  adminUsers: '/admin/users',
  adminUserCreate: '/admin/users/new',
  adminUserDetail: '/admin/users/$userId',
  adminOrganizations: '/admin/organizations',
  adminOrganizationCreate: '/admin/organizations/new',
  adminOrganizationDetail: '/admin/organizations/$organizationId',
  adminInstances: '/admin/instances',
  adminRoles: '/admin/roles',
  adminRoleDetail: '/admin/roles/$roleId',
  adminGroups: '/admin/groups',
  adminGroupCreate: '/admin/groups/new',
  adminGroupDetail: '/admin/groups/$groupId',
  adminLegalTexts: '/admin/legal-texts',
  adminLegalTextCreate: '/admin/legal-texts/new',
  adminLegalTextDetail: '/admin/legal-texts/$legalTextVersionId',
  adminIam: '/admin/iam',
} as const;

export const accountUiRouteGuards = {
  account: createProtectedRoute(),
  accountPrivacy: createProtectedRoute(),
  content: createProtectedRoute({ requiredRoles: ['system_admin', 'app_manager', 'editor'] }),
  contentCreate: createProtectedRoute({ requiredRoles: ['system_admin', 'app_manager', 'editor'] }),
  contentDetail: createProtectedRoute({ requiredRoles: ['system_admin', 'app_manager', 'editor'] }),
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

export type AccountUiRouteKey = keyof typeof accountUiRoutePaths;
