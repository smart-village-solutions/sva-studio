import type { PluginTranslations } from '@sva/plugin-sdk';
import { genericItemsTranslationsDe } from './plugin.translations.de.js';
import { genericItemsTranslationsEn } from './plugin.translations.en.js';

export const pluginGenericItemsTranslations = {
  de: genericItemsTranslationsDe,
  en: genericItemsTranslationsEn,
} satisfies PluginTranslations;
