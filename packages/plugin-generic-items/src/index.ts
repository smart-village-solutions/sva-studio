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
  pluginGenericItemsActionDefinitions,
  pluginGenericItemsPermissionDefinitions,
} from './plugin.js';

import { pluginGenericItems as descriptor } from './plugin.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';
import { deleteGenericItem, getGenericItem, updateGenericItem } from './generic-items.api.js';
const contentMutations: ContentTypeMutations = {
  delete: { requiredAction: 'generic-items.delete', execute: deleteGenericItem },
  status: {
    requiredAction: 'generic-items.update',
    supportedStatuses: ['draft', 'published'],
    execute: async (contentId, status, principal) => {
      const current = await getGenericItem(contentId);
      await updateGenericItem(
        contentId,
        { ...current, visible: status === 'published' },
        principal
      );
    },
  },
};
export const pluginGenericItems: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};
