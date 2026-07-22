import {
  createStandardContentPluginDefinition,
  createStandardContentPluginContribution,
  type PluginDefinition,
} from '@sva/plugin-sdk';

import { FAQ_CONTENT_TYPE } from './faq.constants.js';
import { pluginFaqTranslations } from './plugin.translations.js';

const contribution = createStandardContentPluginContribution({
  pluginId: 'faq',
  displayName: 'FAQ',
  contentType: FAQ_CONTENT_TYPE,
  titleKey: 'faq.navigation.title',
  listBindingKey: 'faqList',
  detailBindingKey: 'faqDetail',
  editorBindingKey: 'faqEditor',
});

export const pluginFaq: PluginDefinition = createStandardContentPluginDefinition({
  pluginId: 'faq',
  displayName: 'FAQ',
  contribution,
  translations: pluginFaqTranslations,
});

export const pluginFaqPermissionDefinitions = contribution.permissions;
export const pluginFaqActionDefinitions = contribution.actions;
