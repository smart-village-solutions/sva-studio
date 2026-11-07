import type { PluginTranslations } from '@sva/plugin-sdk';
import { jobTranslationsDe } from './plugin.translations.de.js';
import { jobTranslationsEn } from './plugin.translations.en.js';
export const pluginJobsTranslations = {
  de: { jobs: jobTranslationsDe },
  en: { jobs: jobTranslationsEn },
} satisfies PluginTranslations;
