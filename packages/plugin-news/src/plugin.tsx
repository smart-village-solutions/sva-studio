import {
  defineMediaPickerDefinition,
  createStandardContentPluginActionIds,
  createStandardContentPluginDefinition,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { NEWS_CONTENT_TYPE } from './news.constants.js';
import { pluginNewsTranslations } from './plugin.translations.js';
export { NEWS_CONTENT_TYPE } from './news.constants.js';

export const pluginNewsActionIds = createStandardContentPluginActionIds('news');

const standardNewsContribution = createStandardContentPluginContribution({
  pluginId: 'news',
  displayName: 'News',
  contentType: NEWS_CONTENT_TYPE,
  titleKey: 'news.navigation.title',
  listBindingKey: 'newsList',
  detailBindingKey: 'newsDetail',
  editorBindingKey: 'newsEditor',
  actionOptions: {
    legacyAliases: {
      create: ['create'],
      edit: ['edit'],
      update: ['save', 'update'],
      delete: ['delete'],
    },
  },
});

export const pluginNewsPermissionDefinitions = standardNewsContribution.permissions;

export const pluginNewsActionDefinitions = standardNewsContribution.actions;

export const pluginNewsMediaPickers = {
  teaserImage: defineMediaPickerDefinition({
    roles: ['teaser_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'teaser',
  }),
  headerImage: defineMediaPickerDefinition({
    roles: ['header_image'],
    allowedMediaTypes: ['image'],
    presetKey: 'hero',
  }),
} as const;

export const getPluginNewsActionDefinition = (
  actionId: (typeof pluginNewsActionIds)[keyof typeof pluginNewsActionIds]
) => pluginNewsActionDefinitions.find((action) => action.id === actionId);

export const pluginNews: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'news',
  displayName: 'News',
  contribution: standardNewsContribution,
  translations: pluginNewsTranslations,
});
