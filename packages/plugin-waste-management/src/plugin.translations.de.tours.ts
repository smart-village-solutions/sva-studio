import { createWasteManagementToursTranslations } from './plugin.translations.shared.scheduling.js';
import { wasteManagementPluginTranslationsDEToursList } from './plugin.translations.de.tours.list.js';
import { wasteManagementPluginTranslationsDEToursDetails } from './plugin.translations.de.tours.details.js';

export const wasteManagementPluginTranslationsDETours = createWasteManagementToursTranslations({
  ...wasteManagementPluginTranslationsDEToursList,
  ...wasteManagementPluginTranslationsDEToursDetails,
});
