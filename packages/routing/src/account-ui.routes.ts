import { createAdminRoute, createProtectedRoute, type ProtectedRouteOptions } from './protected.routes.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { uiRoutePaths } from './route-paths.js';

export type AccountUiRouteGuardKey =
  | 'account'
  | 'accountPrivacy'
  | 'content'
  | 'contentCreate'
  | 'contentDetail'
  | 'adminUsers'
  | 'adminUserCreate'
  | 'adminUserDetail'
  | 'adminOrganizations'
  | 'adminOrganizationCreate'
  | 'adminOrganizationDetail'
  | 'adminInstances'
  | 'adminRoles'
  | 'adminRoleDetail'
  | 'adminGroups'
  | 'adminGroupCreate'
  | 'adminGroupDetail'
  | 'adminLegalTexts'
  | 'adminLegalTextCreate'
  | 'adminLegalTextDetail'
  | 'adminIam';

type AccountUiRouteGuardDefinition = {
  readonly kind: 'admin' | 'protected';
  readonly route: string;
  readonly requiredRoles?: ProtectedRouteOptions['requiredRoles'];
};

export const accountUiRouteGuardDefinitions: Record<AccountUiRouteGuardKey, AccountUiRouteGuardDefinition> = {
  account: { kind: 'protected', route: uiRoutePaths.account },
  accountPrivacy: { kind: 'protected', route: uiRoutePaths.accountPrivacy },
  content: { kind: 'protected', route: uiRoutePaths.content },
  contentCreate: { kind: 'protected', route: uiRoutePaths.contentCreate },
  contentDetail: { kind: 'protected', route: uiRoutePaths.contentDetail },
  adminUsers: { kind: 'admin', route: uiRoutePaths.adminUsers },
  adminUserCreate: { kind: 'admin', route: uiRoutePaths.adminUserCreate },
  adminUserDetail: { kind: 'admin', route: uiRoutePaths.adminUserDetail },
  adminOrganizations: { kind: 'admin', route: uiRoutePaths.adminOrganizations },
  adminOrganizationCreate: { kind: 'admin', route: uiRoutePaths.adminOrganizationCreate },
  adminOrganizationDetail: { kind: 'admin', route: uiRoutePaths.adminOrganizationDetail },
  adminInstances: {
    kind: 'protected',
    route: uiRoutePaths.adminInstances,
    requiredRoles: ['instance_registry_admin'],
  },
  adminRoles: { kind: 'protected', route: uiRoutePaths.adminRoles, requiredRoles: ['system_admin'] },
  adminRoleDetail: { kind: 'protected', route: uiRoutePaths.adminRoleDetail, requiredRoles: ['system_admin'] },
  adminGroups: { kind: 'protected', route: uiRoutePaths.adminGroups, requiredRoles: ['system_admin'] },
  adminGroupCreate: { kind: 'protected', route: uiRoutePaths.adminGroupCreate, requiredRoles: ['system_admin'] },
  adminGroupDetail: { kind: 'protected', route: uiRoutePaths.adminGroupDetail, requiredRoles: ['system_admin'] },
  adminLegalTexts: { kind: 'protected', route: uiRoutePaths.adminLegalTexts, requiredRoles: ['system_admin'] },
  adminLegalTextCreate: {
    kind: 'protected',
    route: uiRoutePaths.adminLegalTextCreate,
    requiredRoles: ['system_admin'],
  },
  adminLegalTextDetail: {
    kind: 'protected',
    route: uiRoutePaths.adminLegalTextDetail,
    requiredRoles: ['system_admin'],
  },
  adminIam: {
    kind: 'protected',
    route: uiRoutePaths.adminIam,
    requiredRoles: ['iam_admin', 'support_admin', 'system_admin', 'security_admin', 'compliance_officer'],
  },
};

export const createAccountUiRouteGuard = (
  guardKey: AccountUiRouteGuardKey,
  diagnostics?: RoutingDiagnosticsHook,
  route: string = accountUiRouteGuardDefinitions[guardKey].route
) => {
  const definition = accountUiRouteGuardDefinitions[guardKey];
  if (definition.kind === 'admin') {
    return createAdminRoute({ diagnostics, route });
  }

  return createProtectedRoute({
    diagnostics,
    route,
    requiredRoles: definition.requiredRoles,
  });
};

export const createAccountUiRouteGuards = (diagnostics?: RoutingDiagnosticsHook) =>
  ({
    account: createAccountUiRouteGuard('account', diagnostics),
    accountPrivacy: createAccountUiRouteGuard('accountPrivacy', diagnostics),
    content: createAccountUiRouteGuard('content', diagnostics),
    contentCreate: createAccountUiRouteGuard('contentCreate', diagnostics),
    contentDetail: createAccountUiRouteGuard('contentDetail', diagnostics),
    adminUsers: createAccountUiRouteGuard('adminUsers', diagnostics),
    adminUserCreate: createAccountUiRouteGuard('adminUserCreate', diagnostics),
    adminUserDetail: createAccountUiRouteGuard('adminUserDetail', diagnostics),
    adminOrganizations: createAccountUiRouteGuard('adminOrganizations', diagnostics),
    adminOrganizationCreate: createAccountUiRouteGuard('adminOrganizationCreate', diagnostics),
    adminOrganizationDetail: createAccountUiRouteGuard('adminOrganizationDetail', diagnostics),
    adminInstances: createAccountUiRouteGuard('adminInstances', diagnostics),
    adminRoles: createAccountUiRouteGuard('adminRoles', diagnostics),
    adminRoleDetail: createAccountUiRouteGuard('adminRoleDetail', diagnostics),
    adminGroups: createAccountUiRouteGuard('adminGroups', diagnostics),
    adminGroupCreate: createAccountUiRouteGuard('adminGroupCreate', diagnostics),
    adminGroupDetail: createAccountUiRouteGuard('adminGroupDetail', diagnostics),
    adminLegalTexts: createAccountUiRouteGuard('adminLegalTexts', diagnostics),
    adminLegalTextCreate: createAccountUiRouteGuard('adminLegalTextCreate', diagnostics),
    adminLegalTextDetail: createAccountUiRouteGuard('adminLegalTextDetail', diagnostics),
    adminIam: createAccountUiRouteGuard('adminIam', diagnostics),
  }) as const;

export const accountUiRouteGuards = createAccountUiRouteGuards();
