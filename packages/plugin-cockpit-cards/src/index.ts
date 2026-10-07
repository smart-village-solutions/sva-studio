export {
  pluginCockpitCards,
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
