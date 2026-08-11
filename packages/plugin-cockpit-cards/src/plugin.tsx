import {
  createStandardContentPluginContribution,
  createStandardContentPluginDefinition,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { cockpitCardsMainserverGenericItemOwnership } from './generic-item-ownership.js';
import { pluginCockpitCardsTranslations } from './plugin.translations.js';

const contribution = createStandardContentPluginContribution({
  pluginId: 'cockpit-cards',
  displayName: 'Kacheln',
  contentType: cockpitCardsMainserverGenericItemOwnership.contentType,
  mainserverGenericType: cockpitCardsMainserverGenericItemOwnership.mainserverGenericType,
  titleKey: 'cockpit-cards.navigation.title',
  listBindingKey: 'cockpitCardsList',
  detailBindingKey: 'cockpitCardsDetail',
  editorBindingKey: 'cockpitCardsEditor',
});

export const pluginCockpitCards: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'cockpit-cards',
  displayName: 'Kacheln',
  contribution,
  translations: pluginCockpitCardsTranslations,
});
export const pluginCockpitCardsPermissionDefinitions = contribution.permissions;
export const pluginCockpitCardsActionDefinitions = contribution.actions;
