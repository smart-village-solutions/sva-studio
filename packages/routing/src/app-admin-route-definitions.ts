import {
  normalizeIamTab,
  normalizeOrganizationDetailTab,
  normalizeRoleDetailTab,
} from './route-search.js';
import { uiRoutePaths } from './route-paths.js';
import { page, type UiRouteDefinition } from './app-route-definitions.js';

export const adminUiRouteDefinitions: readonly UiRouteDefinition[] = [
  {
    binding: 'adminUsers',
    path: uiRoutePaths.adminUsers,
    guard: 'adminUsers',
    documentation: page('admin.users.list', 'list'),
  },
  {
    binding: 'adminUserCreate',
    path: uiRoutePaths.adminUserCreate,
    guard: 'adminUserCreate',
    documentation: page('admin.users.create', 'create'),
  },
  {
    binding: 'adminUserDetail',
    path: uiRoutePaths.adminUserDetail,
    guard: 'adminUserDetail',
    documentation: page('admin.users.detail', 'detail'),
  },
  {
    binding: 'adminUserInvitationTemplate',
    path: uiRoutePaths.adminUserInvitationTemplate,
    guard: 'adminUserInvitationTemplate',
    documentation: page('admin.users.invitation-template', 'detail'),
  },
  {
    binding: 'adminOrganizations',
    path: uiRoutePaths.adminOrganizations,
    guard: 'adminOrganizations',
    documentation: page('admin.organizations.list', 'list'),
  },
  {
    binding: 'adminOrganizationCreate',
    path: uiRoutePaths.adminOrganizationCreate,
    guard: 'adminOrganizationCreate',
    documentation: page('admin.organizations.create', 'create'),
  },
  {
    binding: 'adminOrganizationDetail',
    path: uiRoutePaths.adminOrganizationDetail,
    guard: 'adminOrganizationDetail',
    documentation: page('admin.organizations.detail', 'detail'),
    validateSearch: (search: Record<string, unknown>) => ({
      tab: normalizeOrganizationDetailTab(search.tab),
    }),
  },
  {
    binding: 'adminInstances',
    path: uiRoutePaths.adminInstances,
    guard: 'adminInstances',
    documentation: page('admin.instances.list', 'list'),
  },
  {
    binding: 'adminInstanceCreate',
    path: uiRoutePaths.adminInstanceCreate,
    guard: 'adminInstances',
    documentation: page('admin.instances.create', 'create'),
  },
  {
    binding: 'adminInstanceDetail',
    path: uiRoutePaths.adminInstanceDetail,
    guard: 'adminInstances',
    documentation: page('admin.instances.detail', 'detail'),
  },
  {
    binding: 'adminTemplates',
    path: uiRoutePaths.adminTemplates,
    guard: 'adminTemplates',
    documentation: page('admin.templates', 'detail'),
  },
  {
    binding: 'adminRoles',
    path: uiRoutePaths.adminRoles,
    guard: 'adminRoles',
    documentation: page('admin.roles.list', 'list'),
  },
  {
    binding: 'adminRoleCreate',
    path: uiRoutePaths.adminRoleCreate,
    guard: 'adminRoleCreate',
    documentation: page('admin.roles.create', 'create'),
  },
  {
    binding: 'adminRoleDetail',
    path: uiRoutePaths.adminRoleDetail,
    guard: 'adminRoleDetail',
    documentation: page('admin.roles.detail', 'detail'),
    validateSearch: (search: Record<string, unknown>) => ({
      tab: normalizeRoleDetailTab(search.tab),
    }),
  },
  {
    binding: 'adminGroups',
    path: uiRoutePaths.adminGroups,
    guard: 'adminGroups',
    documentation: page('admin.groups.list', 'list'),
  },
  {
    binding: 'adminGroupCreate',
    path: uiRoutePaths.adminGroupCreate,
    guard: 'adminGroupCreate',
    documentation: page('admin.groups.create', 'create'),
  },
  {
    binding: 'adminGroupDetail',
    path: uiRoutePaths.adminGroupDetail,
    guard: 'adminGroupDetail',
    documentation: page('admin.groups.detail', 'detail'),
  },
  {
    binding: 'adminLegalTexts',
    path: uiRoutePaths.adminLegalTexts,
    guard: 'adminLegalTexts',
    documentation: page('admin.legal-texts.list', 'list'),
  },
  {
    binding: 'adminLegalTextCreate',
    path: uiRoutePaths.adminLegalTextCreate,
    guard: 'adminLegalTextCreate',
    documentation: page('admin.legal-texts.create', 'create'),
  },
  {
    binding: 'adminLegalTextDetail',
    path: uiRoutePaths.adminLegalTextDetail,
    guard: 'adminLegalTextDetail',
    documentation: page('admin.legal-texts.detail', 'detail'),
  },
  {
    binding: 'adminIam',
    path: uiRoutePaths.adminIam,
    guard: 'adminIam',
    documentation: page('admin.iam.overview', 'overview'),
    validateSearch: (search: Record<string, unknown>) => ({ tab: normalizeIamTab(search.tab) }),
  },
  {
    binding: 'adminIamGovernanceDetail',
    path: uiRoutePaths.adminIamGovernanceDetail,
    guard: 'adminIam',
    documentation: page('admin.iam.governance-detail', 'detail'),
  },
  {
    binding: 'adminIamDsrDetail',
    path: uiRoutePaths.adminIamDsrDetail,
    guard: 'adminIam',
    documentation: page('admin.iam.dsr-detail', 'detail'),
  },
] as const;
