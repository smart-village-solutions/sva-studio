import { createWasteManagementTabsTranslations } from './plugin.translations.shared.sections.js';

export const wasteManagementPluginTranslationsENTabs = createWasteManagementTabsTranslations({
  ariaLabel: 'Waste management areas',
  fractions: [
    'Waste types',
    'Manage fractions, colors, and translations as a dedicated waste management workspace.',
    'No waste types yet',
    'Create the first fraction to make collection types available for tours and pickup locations.',
  ],
  tours: [
    'Tours',
    'Tours, assignments and tour-specific maintenance get their own focused work area.',
    'Tours coming next',
    'The first route already preserves shareable tab and filter state for this area.',
  ],
  locations: [
    'Pickup locations',
    'Manage regions, cities, streets, house numbers, and concrete pickup locations in one shared location context.',
    'No pickup locations yet',
    'As soon as regions and address data exist, pickup locations will appear in this area.',
  ],
  scheduling: [
    'Schedule deviations',
    'Global and tour-related shifts remain visible as an explicit scheduling context.',
    'Schedule deviations coming next',
    'Calendar, bulk and conflict surfaces will be added here later.',
  ],
  tools: [
    'Data tools',
    'Import, migration, seed and reset are started through the host generic job capability.',
    'Tools coming next',
    'Job starters and progress views will be attached to the host endpoints in the next slice.',
  ],
  settings: [
    'Settings',
    'The instance-specific waste data source remains reachable and reconfigurable even during error states.',
    'Settings coming next',
    'The existing settings facade will be integrated directly into this tab afterwards.',
  ],
});
