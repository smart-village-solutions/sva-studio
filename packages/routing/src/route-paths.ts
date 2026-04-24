import { authRoutePaths } from '@sva/auth-runtime';

export const uiRoutePaths = {
  home: '/',
  account: '/account',
  accountPrivacy: '/account/privacy',
  content: '/admin/content',
  contentCreate: '/admin/content/new',
  contentDetail: '/admin/content/$id',
  media: '/media',
  categories: '/categories',
  app: '/app',
  interfaces: '/interfaces',
  help: '/help',
  support: '/support',
  license: '/license',
  adminUsers: '/admin/users',
  adminUserCreate: '/admin/users/new',
  adminUserDetail: '/admin/users/$userId',
  adminOrganizations: '/admin/organizations',
  adminOrganizationCreate: '/admin/organizations/new',
  adminOrganizationDetail: '/admin/organizations/$organizationId',
  adminInstances: '/admin/instances',
  adminInstanceCreate: '/admin/instances/new',
  adminInstanceDetail: '/admin/instances/$instanceId',
  adminRoles: '/admin/roles',
  adminRoleCreate: '/admin/roles/new',
  adminRoleDetail: '/admin/roles/$roleId',
  adminGroups: '/admin/groups',
  adminGroupCreate: '/admin/groups/new',
  adminGroupDetail: '/admin/groups/$groupId',
  adminLegalTexts: '/admin/legal-texts',
  adminLegalTextCreate: '/admin/legal-texts/new',
  adminLegalTextDetail: '/admin/legal-texts/$legalTextVersionId',
  adminIam: '/admin/iam',
  modules: '/modules',
  monitoring: '/monitoring',
  adminApiPhase1Test: '/admin/api/phase1-test',
} as const;

export const routePaths = {
  home: uiRoutePaths.home,
  ui: uiRoutePaths,
  auth: authRoutePaths,
  pluginPrefix: '/plugins',
} as const;

export type UiRoutePathKey = keyof typeof uiRoutePaths;
