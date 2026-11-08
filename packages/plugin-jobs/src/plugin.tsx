import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  definePluginModuleIamContract,
} from '@sva/plugin-sdk';
import { jobsMainserverGenericItemOwnership } from './generic-item-ownership.js';
import { pluginJobsTranslations } from './plugin.translations.js';

const base = createStandardContentPluginContribution({
  pluginId: 'jobs',
  displayName: 'Stellenanzeigen',
  contentType: jobsMainserverGenericItemOwnership.contentType,
  mainserverGenericType: jobsMainserverGenericItemOwnership.mainserverGenericType,
  titleKey: 'jobs.navigation.title',
  listBindingKey: 'jobsList',
  detailBindingKey: 'jobsDetail',
  editorBindingKey: 'jobsEditor',
});
const permissions = base.permissions;
const actions = base.actions;
const permissionIds = permissions.map((entry) => entry.id);
export const pluginJobs = createStandardContentPluginDefinition({
  pluginId: 'jobs',
  displayName: 'Stellenanzeigen',
  translations: pluginJobsTranslations,
  contribution: {
    ...base,
    actions,
    permissions,
    moduleIam: definePluginModuleIamContract('jobs', {
      moduleId: 'jobs',
      permissionIds,
      systemRoles: [{ roleName: 'system_admin', permissionIds }],
    }),
  },
});
export const pluginJobsActionDefinitions = actions;
export const pluginJobsPermissionDefinitions = permissions;
