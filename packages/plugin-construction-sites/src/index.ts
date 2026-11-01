export * from './contract.js';
export {
  pluginConstructionSites,
  pluginConstructionSitesActionDefinitions,
  pluginConstructionSitesPermissionDefinitions,
} from './plugin.js';
import {
  ConstructionSitesCreatePage,
  ConstructionSitesEditPage,
} from './construction-sites.pages.js';
import { ConstructionSitesListPage } from './construction-sites.list.js';
export const pluginViewBindings = [
  { bindingKey: 'constructionSitesList', component: ConstructionSitesListPage },
  { bindingKey: 'constructionSitesDetail', component: ConstructionSitesEditPage },
  { bindingKey: 'constructionSitesEditor', component: ConstructionSitesCreatePage },
] as const;
