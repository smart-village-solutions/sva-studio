import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { COCKPIT_CARD_CONTENT_TYPE } from './cockpit-cards.constants.js';
import { pluginCockpitCardsTranslations } from './plugin.translations.js';

const contribution = createStandardContentPluginContribution({
  pluginId: 'cockpit-cards',
  displayName: 'Cockpit Cards',
  contentType: COCKPIT_CARD_CONTENT_TYPE,
  titleKey: 'cockpit-cards.navigation.title',
  listBindingKey: 'cockpitCardsList',
  detailBindingKey: 'cockpitCardsDetail',
  editorBindingKey: 'cockpitCardsEditor',
});

export const pluginCockpitCards: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'cockpit-cards',
  displayName: 'Cockpit Cards',
  contribution,
  translations: pluginCockpitCardsTranslations,
});
export const pluginCockpitCardsPermissionDefinitions = contribution.permissions;
export const pluginCockpitCardsActionDefinitions = contribution.actions;
