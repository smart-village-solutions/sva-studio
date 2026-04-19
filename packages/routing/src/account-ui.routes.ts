import { createAdminRoute, createProtectedRoute } from './protected.routes.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { uiRoutePaths } from './route-paths.js';

export const createAccountUiRouteGuards = (diagnostics?: RoutingDiagnosticsHook) =>
  ({
    account: createProtectedRoute({ diagnostics, route: uiRoutePaths.account }),
    accountPrivacy: createProtectedRoute({ diagnostics, route: uiRoutePaths.accountPrivacy }),
    content: createProtectedRoute({ diagnostics, route: uiRoutePaths.content }),
    contentCreate: createProtectedRoute({ diagnostics, route: uiRoutePaths.contentCreate }),
    contentDetail: createProtectedRoute({ diagnostics, route: uiRoutePaths.contentDetail }),
    adminUsers: createAdminRoute({ diagnostics, route: uiRoutePaths.adminUsers }),
    adminUserCreate: createAdminRoute({ diagnostics, route: uiRoutePaths.adminUserCreate }),
    adminUserDetail: createAdminRoute({ diagnostics, route: uiRoutePaths.adminUserDetail }),
    adminOrganizations: createAdminRoute({ diagnostics, route: uiRoutePaths.adminOrganizations }),
    adminOrganizationCreate: createAdminRoute({ diagnostics, route: uiRoutePaths.adminOrganizationCreate }),
    adminOrganizationDetail: createAdminRoute({ diagnostics, route: uiRoutePaths.adminOrganizationDetail }),
    adminInstances: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminInstances,
      requiredRoles: ['instance_registry_admin'],
    }),
    adminRoles: createProtectedRoute({ diagnostics, route: uiRoutePaths.adminRoles, requiredRoles: ['system_admin'] }),
    adminRoleDetail: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminRoleDetail,
      requiredRoles: ['system_admin'],
    }),
    adminGroups: createProtectedRoute({ diagnostics, route: uiRoutePaths.adminGroups, requiredRoles: ['system_admin'] }),
    adminGroupCreate: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminGroupCreate,
      requiredRoles: ['system_admin'],
    }),
    adminGroupDetail: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminGroupDetail,
      requiredRoles: ['system_admin'],
    }),
    adminLegalTexts: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminLegalTexts,
      requiredRoles: ['system_admin'],
    }),
    adminLegalTextCreate: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminLegalTextCreate,
      requiredRoles: ['system_admin'],
    }),
    adminLegalTextDetail: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminLegalTextDetail,
      requiredRoles: ['system_admin'],
    }),
    adminIam: createProtectedRoute({
      diagnostics,
      route: uiRoutePaths.adminIam,
      requiredRoles: ['iam_admin', 'support_admin', 'system_admin', 'security_admin', 'compliance_officer'],
    }),
  }) as const;

export const accountUiRouteGuards = createAccountUiRouteGuards();
