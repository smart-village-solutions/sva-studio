import type { PluginTranslations } from '@sva/plugin-sdk';

import { poiTranslationsDe } from './plugin.translations.de.js';
import { poiTranslationsEn } from './plugin.translations.en.js';

export const pluginPoiTranslations = {
  de: poiTranslationsDe,
  en: poiTranslationsEn,
} satisfies PluginTranslations;
