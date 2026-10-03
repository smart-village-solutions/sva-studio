import type { PluginTranslations } from '@sva/plugin-sdk';

import { newsTranslationsDELabels } from './plugin.translations.de.labels.js';
import { newsTranslationsDEEditor } from './plugin.translations.de.editor.js';
import { newsTranslationsENLabels } from './plugin.translations.en.labels.js';
import { newsTranslationsENEditor } from './plugin.translations.en.editor.js';

export const pluginNewsTranslations = {
  de: {
    news: {
      ...newsTranslationsDELabels,
      ...newsTranslationsDEEditor,
    },
  },
  en: {
    news: {
      ...newsTranslationsENLabels,
      ...newsTranslationsENEditor,
    },
  },
} as const satisfies PluginTranslations;
