import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  definePluginModuleIamContract,
} from '@sva/plugin-sdk';
import { constructionSitesMainserverGenericItemOwnership } from './generic-item-ownership.js';
import { pluginConstructionSitesTranslations } from './plugin.translations.js';

const base = createStandardContentPluginContribution({
  pluginId: 'construction-sites',
  displayName: 'Baustellen',
  contentType: constructionSitesMainserverGenericItemOwnership.contentType,
  mainserverGenericType: constructionSitesMainserverGenericItemOwnership.mainserverGenericType,
  titleKey: 'construction-sites.navigation.title',
  listBindingKey: 'constructionSitesList',
  detailBindingKey: 'constructionSitesDetail',
  editorBindingKey: 'constructionSitesEditor',
});
const permissions = base.permissions.filter((entry) => entry.id !== 'construction-sites.delete');
const actions = base.actions.filter((entry) => entry.id !== 'construction-sites.delete');
const permissionIds = permissions.map((entry) => entry.id);
export const pluginConstructionSites = createStandardContentPluginDefinition({
  pluginId: 'construction-sites',
  displayName: 'Baustellen',
  translations: pluginConstructionSitesTranslations,
  contribution: {
    ...base,
    actions,
    permissions,
    moduleIam: definePluginModuleIamContract('construction-sites', {
      moduleId: 'construction-sites',
      permissionIds,
      systemRoles: [{ roleName: 'system_admin', permissionIds }],
    }),
  },
});
export const pluginConstructionSitesActionDefinitions = actions;
export const pluginConstructionSitesPermissionDefinitions = permissions;
