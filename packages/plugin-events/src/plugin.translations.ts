import type { PluginTranslations } from '@sva/plugin-sdk';
import { eventsDELabels } from './plugin.translations.de.labels.js';
import { eventsDEEditor } from './plugin.translations.de.editor.js';
import { eventsENLabels } from './plugin.translations.en.labels.js';
import { eventsENEditor } from './plugin.translations.en.editor.js';

export const pluginEventsTranslations = {
  de: { events: { ...eventsDELabels, ...eventsDEEditor } },
  en: { events: { ...eventsENLabels, ...eventsENEditor } },
} satisfies PluginTranslations;
