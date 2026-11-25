import type { PluginTranslations } from '@sva/plugin-sdk';

import { categoriesTranslationsDe } from './plugin.translations.de.js';
import { categoriesTranslationsEn } from './plugin.translations.en.js';

export const pluginCategoriesTranslations = {
  de: { categories: categoriesTranslationsDe },
  en: { categories: categoriesTranslationsEn },
} as const satisfies PluginTranslations;
