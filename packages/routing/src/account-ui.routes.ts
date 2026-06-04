import { createAdminRoute, createProtectedRoute, type ProtectedRouteOptions } from './protected.routes.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import { uiRoutePaths } from './route-paths.js';

export type AccountUiRouteGuardKey =
  | 'account'
  | 'accountPrivacy'
  | 'accountPrivacyDetail'
  | 'accountRules'
  | 'modules'
  | 'content'
  | 'contentCreate'
  | 'contentDetail'
  | 'media'
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
  readonly requiredPermissions?: ProtectedRouteOptions['requiredPermissions'];
};

export const accountUiRouteGuardDefinitions: Record<AccountUiRouteGuardKey, AccountUiRouteGuardDefinition> = {
  account: { kind: 'protected', route: uiRoutePaths.account },
  accountPrivacy: { kind: 'protected', route: uiRoutePaths.accountPrivacy },
  accountPrivacyDetail: { kind: 'protected', route: uiRoutePaths.accountPrivacyDetail },
  accountRules: { kind: 'protected', route: uiRoutePaths.accountRules },
  modules: { kind: 'protected', route: uiRoutePaths.modules },
  content: { kind: 'protected', route: uiRoutePaths.content },
  contentCreate: { kind: 'protected', route: uiRoutePaths.contentCreate },
  contentDetail: { kind: 'protected', route: uiRoutePaths.contentDetail },
  media: { kind: 'protected', route: uiRoutePaths.media },
  adminUsers: { kind: 'admin', route: uiRoutePaths.adminUsers, requiredPermissions: ['iam.user.read'] },
  adminUserCreate: { kind: 'admin', route: uiRoutePaths.adminUserCreate, requiredPermissions: ['iam.user.write'] },
  adminUserDetail: { kind: 'admin', route: uiRoutePaths.adminUserDetail, requiredPermissions: ['iam.user.read'] },
  adminOrganizations: { kind: 'admin', route: uiRoutePaths.adminOrganizations, requiredPermissions: ['iam.org.read'] },
  adminOrganizationCreate: {
    kind: 'admin',
    route: uiRoutePaths.adminOrganizationCreate,
    requiredPermissions: ['iam.org.write'],
  },
  adminOrganizationDetail: {
    kind: 'admin',
    route: uiRoutePaths.adminOrganizationDetail,
    requiredPermissions: ['iam.org.read'],
  },
  adminInstances: {
    kind: 'protected',
    route: uiRoutePaths.adminInstances,
    requiredRoles: ['instance_registry_admin'],
  },
  adminRoles: { kind: 'protected', route: uiRoutePaths.adminRoles, requiredPermissions: ['iam.role.read'] },
  adminRoleDetail: {
    kind: 'protected',
    route: uiRoutePaths.adminRoleDetail,
    requiredPermissions: ['iam.role.read'],
  },
  adminGroups: { kind: 'protected', route: uiRoutePaths.adminGroups, requiredPermissions: ['iam.role.read'] },
  adminGroupCreate: {
    kind: 'protected',
    route: uiRoutePaths.adminGroupCreate,
    requiredPermissions: ['iam.role.write'],
  },
  adminGroupDetail: {
    kind: 'protected',
    route: uiRoutePaths.adminGroupDetail,
    requiredPermissions: ['iam.role.read'],
  },
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
    return createAdminRoute({
      diagnostics,
      route,
      requiredPermissions: definition.requiredPermissions,
    });
  }

  return createProtectedRoute({
    diagnostics,
    route,
    requiredPermissions: definition.requiredPermissions,
    requiredRoles: definition.requiredRoles,
  });
};

export const createAccountUiRouteGuards = (diagnostics?: RoutingDiagnosticsHook) =>
  ({
    account: createAccountUiRouteGuard('account', diagnostics),
    accountPrivacy: createAccountUiRouteGuard('accountPrivacy', diagnostics),
    accountPrivacyDetail: createAccountUiRouteGuard('accountPrivacyDetail', diagnostics),
    accountRules: createAccountUiRouteGuard('accountRules', diagnostics),
    modules: createAccountUiRouteGuard('modules', diagnostics),
    content: createAccountUiRouteGuard('content', diagnostics),
    contentCreate: createAccountUiRouteGuard('contentCreate', diagnostics),
    contentDetail: createAccountUiRouteGuard('contentDetail', diagnostics),
    media: createAccountUiRouteGuard('media', diagnostics),
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
