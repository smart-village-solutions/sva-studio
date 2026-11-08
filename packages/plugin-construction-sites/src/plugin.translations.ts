import type { PluginTranslations } from '@sva/plugin-sdk';
import { constructionSiteTranslationsDe } from './plugin.translations.de.js';
import { constructionSiteTranslationsEn } from './plugin.translations.en.js';
export const pluginConstructionSitesTranslations = {
  de: { 'construction-sites': constructionSiteTranslationsDe },
  en: { 'construction-sites': constructionSiteTranslationsEn },
} satisfies PluginTranslations;
