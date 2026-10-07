export {
  pluginCockpitCardsActionDefinitions,
  pluginCockpitCardsPermissionDefinitions,
} from './plugin.js';
export {
  CockpitCardsCreatePage,
  CockpitCardsEditPage,
  CockpitCardsListPage,
} from './cockpit-cards.pages.js';
export {
  createCockpitCard,
  deleteCockpitCard,
  getCockpitCard,
  listCockpitCards,
  updateCockpitCard,
} from './cockpit-cards.api.js';
import {
  CockpitCardsCreatePage,
  CockpitCardsEditPage,
  CockpitCardsListPage,
} from './cockpit-cards.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'cockpitCardsList', component: CockpitCardsListPage },
  { bindingKey: 'cockpitCardsDetail', component: CockpitCardsEditPage },
  { bindingKey: 'cockpitCardsEditor', component: CockpitCardsCreatePage },
] as const;

import { pluginCockpitCards as descriptor } from './plugin.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';
import { deleteCockpitCard } from './cockpit-cards.api.js';
const contentMutations: ContentTypeMutations = {
  delete: { requiredAction: 'cockpit-cards.delete', execute: deleteCockpitCard },
};
export const pluginCockpitCards: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};
