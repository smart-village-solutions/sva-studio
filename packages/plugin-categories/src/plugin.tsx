import type { PluginDefinition } from '@sva/plugin-sdk';

import { pluginCategoriesTranslations } from './plugin.translations.js';

export const pluginCategories: PluginDefinition = {
  id: 'categories',
  displayName: 'Kategorien',
  routes: [],
  translations: pluginCategoriesTranslations,
};
