import { createWasteManagementToursTranslations } from './plugin.translations.shared.scheduling.js';
import { wasteManagementPluginTranslationsENToursList } from './plugin.translations.en.tours.list.js';
import { wasteManagementPluginTranslationsENToursDetails } from './plugin.translations.en.tours.details.js';

export const wasteManagementPluginTranslationsENTours = createWasteManagementToursTranslations({
  ...wasteManagementPluginTranslationsENToursList,
  ...wasteManagementPluginTranslationsENToursDetails,
});
