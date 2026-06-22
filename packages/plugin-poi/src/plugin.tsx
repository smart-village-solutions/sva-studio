import {
  defineMediaPickerDefinition,
  createStandardContentPluginDefinition,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { POI_CONTENT_TYPE } from './poi.constants.js';
import { pluginPoiTranslations } from './plugin.translations.js';

const standardPoiContribution = createStandardContentPluginContribution({
  pluginId: 'poi',
  displayName: 'Orte',
  contentType: POI_CONTENT_TYPE,
  titleKey: 'poi.navigation.title',
  listBindingKey: 'poiList',
  detailBindingKey: 'poiDetail',
  editorBindingKey: 'poiEditor',
});

export const pluginPoiPermissionDefinitions = standardPoiContribution.permissions;

export const pluginPoiActionDefinitions = standardPoiContribution.actions;

export const pluginPoiMediaPickers = {
  images: defineMediaPickerDefinition({
    roles: ['attachment_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'gallery',
  }),
} as const;

export const pluginPoi: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'poi',
  displayName: 'Orte',
  contribution: standardPoiContribution,
  translations: pluginPoiTranslations,
});
