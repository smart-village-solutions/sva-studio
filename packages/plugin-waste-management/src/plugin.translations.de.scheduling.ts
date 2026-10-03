import { createWasteManagementSchedulingTranslations } from './plugin.translations.shared.scheduling.js';
import { wasteManagementPluginTranslationsDESchedulingScopes } from './plugin.translations.de.scheduling.scopes.js';
import { wasteManagementPluginTranslationsDESchedulingSections } from './plugin.translations.de.scheduling.sections.js';

export const wasteManagementPluginTranslationsDEScheduling =
  createWasteManagementSchedulingTranslations({
    ...wasteManagementPluginTranslationsDESchedulingScopes,
    ...wasteManagementPluginTranslationsDESchedulingSections,
  });
