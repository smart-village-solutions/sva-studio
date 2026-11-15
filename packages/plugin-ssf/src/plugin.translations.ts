/** Compose the existing German and English plugin resources. */
import type { PluginTranslations } from '@sva/plugin-sdk';
import { de } from './plugin.translations.de.js';
import { en } from './plugin.translations.en.js';
export const ssfPluginTranslations = { de, en } as const satisfies PluginTranslations;
