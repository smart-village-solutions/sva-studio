import { createAdminRoute, createProtectedRoute } from './protected.routes.js';
import type { RoutingDiagnosticsHook } from './diagnostics.js';
import {
  accountUiRouteGuardDefinitions,
  type AccountUiRouteGuardKey,
} from './account-ui.route-definitions.js';

export type { AccountUiRouteGuardKey } from './account-ui.route-definitions.js';

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
    requiredAnyPermissions: definition.requiredAnyPermissions,
    requiredAnyRoles: definition.requiredAnyRoles,
    requiredRoles: definition.requiredRoles,
  });
};

export const createAccountUiRouteGuards = (diagnostics?: RoutingDiagnosticsHook) =>
  ({
    account: createAccountUiRouteGuard('account', diagnostics),
    accountPrivacy: createAccountUiRouteGuard('accountPrivacy', diagnostics),
    accountPrivacyDetail: createAccountUiRouteGuard('accountPrivacyDetail', diagnostics),
    accountRules: createAccountUiRouteGuard('accountRules', diagnostics),
    appTexts: createAccountUiRouteGuard('appTexts', diagnostics),
    modules: createAccountUiRouteGuard('modules', diagnostics),
    content: createAccountUiRouteGuard('content', diagnostics),
    contentCreate: createAccountUiRouteGuard('contentCreate', diagnostics),
    contentDetail: createAccountUiRouteGuard('contentDetail', diagnostics),
    media: createAccountUiRouteGuard('media', diagnostics),
    interfaces: createAccountUiRouteGuard('interfaces', diagnostics),
    adminUsers: createAccountUiRouteGuard('adminUsers', diagnostics),
    adminUserCreate: createAccountUiRouteGuard('adminUserCreate', diagnostics),
    adminUserDetail: createAccountUiRouteGuard('adminUserDetail', diagnostics),
    adminUserInvitationTemplate: createAccountUiRouteGuard(
      'adminUserInvitationTemplate',
      diagnostics
    ),
    adminOrganizations: createAccountUiRouteGuard('adminOrganizations', diagnostics),
    adminOrganizationCreate: createAccountUiRouteGuard('adminOrganizationCreate', diagnostics),
    adminOrganizationDetail: createAccountUiRouteGuard('adminOrganizationDetail', diagnostics),
    adminInstances: createAccountUiRouteGuard('adminInstances', diagnostics),
    adminTemplates: createAccountUiRouteGuard('adminTemplates', diagnostics),
    adminRoles: createAccountUiRouteGuard('adminRoles', diagnostics),
    adminRoleCreate: createAccountUiRouteGuard('adminRoleCreate', diagnostics),
    adminRoleDetail: createAccountUiRouteGuard('adminRoleDetail', diagnostics),
    adminGroups: createAccountUiRouteGuard('adminGroups', diagnostics),
    adminGroupCreate: createAccountUiRouteGuard('adminGroupCreate', diagnostics),
    adminGroupDetail: createAccountUiRouteGuard('adminGroupDetail', diagnostics),
    adminLegalTexts: createAccountUiRouteGuard('adminLegalTexts', diagnostics),
    adminLegalTextCreate: createAccountUiRouteGuard('adminLegalTextCreate', diagnostics),
    adminLegalTextDetail: createAccountUiRouteGuard('adminLegalTextDetail', diagnostics),
    adminIam: createAccountUiRouteGuard('adminIam', diagnostics),
    monitoring: createAccountUiRouteGuard('monitoring', diagnostics),
    monitoringJobs: createAccountUiRouteGuard('monitoringJobs', diagnostics),
    monitoringJobDetail: createAccountUiRouteGuard('monitoringJobDetail', diagnostics),
  }) as const;

export const accountUiRouteGuards = createAccountUiRouteGuards();
