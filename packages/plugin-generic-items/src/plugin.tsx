import {
  createStandardContentPluginDefinition,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { GENERIC_ITEMS_CONTENT_TYPE } from './generic-items.constants.js';
import { pluginGenericItemsTranslations } from './plugin.translations.js';

const standardGenericItemsContribution = createStandardContentPluginContribution({
  pluginId: 'generic-items',
  displayName: 'Generic Items',
  contentType: GENERIC_ITEMS_CONTENT_TYPE,
  titleKey: 'genericItems.navigation.title',
  listBindingKey: 'genericItemsList',
  detailBindingKey: 'genericItemsDetail',
  editorBindingKey: 'genericItemsEditor',
  basePath: 'generic-items',
});

export const pluginGenericItemsPermissionDefinitions = standardGenericItemsContribution.permissions;
export const pluginGenericItemsActionDefinitions = standardGenericItemsContribution.actions;

export const pluginGenericItems: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'generic-items',
  displayName: 'Generic Items',
  contribution: standardGenericItemsContribution,
  translations: pluginGenericItemsTranslations,
});
