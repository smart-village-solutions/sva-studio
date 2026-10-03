import { createWasteManagementSchedulingTranslations } from './plugin.translations.shared.scheduling.js';
import { wasteManagementPluginTranslationsENSchedulingScopes } from './plugin.translations.en.scheduling.scopes.js';
import { wasteManagementPluginTranslationsENSchedulingSections } from './plugin.translations.en.scheduling.sections.js';

export const wasteManagementPluginTranslationsENScheduling =
  createWasteManagementSchedulingTranslations({
    ...wasteManagementPluginTranslationsENSchedulingScopes,
    ...wasteManagementPluginTranslationsENSchedulingSections,
  });
