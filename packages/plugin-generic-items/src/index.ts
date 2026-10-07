export {
  GenericItemsApiError,
  deleteGenericItem,
  createGenericItem,
  getGenericItem,
  listGenericItems,
  updateGenericItem,
} from './generic-items.api.js';
export {
  GenericItemsCreatePage,
  GenericItemsEditPage,
  GenericItemsListPage,
} from './generic-items.pages.js';
import { GenericItemsCreatePage, GenericItemsEditPage } from './generic-items.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'genericItemsDetail', component: GenericItemsEditPage },
  { bindingKey: 'genericItemsEditor', component: GenericItemsCreatePage },
] as const;
export {
  pluginGenericItems,
  pluginGenericItemsActionDefinitions,
  pluginGenericItemsPermissionDefinitions,
} from './plugin.js';
