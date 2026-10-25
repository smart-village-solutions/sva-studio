import type { PluginTranslations } from '@sva/plugin-sdk';
import { voucherTranslationsDe } from './plugin.translations.de.js';
import { voucherTranslationsEn } from './plugin.translations.en.js';
export const pluginVouchersTranslations = {
  de: { vouchers: voucherTranslationsDe },
  en: { vouchers: voucherTranslationsEn },
} as const satisfies PluginTranslations;
