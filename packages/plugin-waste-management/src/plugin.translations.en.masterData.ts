import { wasteManagementPluginTranslationsENMasterDataEntities } from './plugin.translations.en.masterData.entities.js';
import { wasteManagementPluginTranslationsENMasterDataFractions } from './plugin.translations.en.masterData.fractions.js';
import { wasteManagementPluginTranslationsENMasterDataLocationsWorkspace } from './plugin.translations.en.masterData.locations-workspace.js';
import {
  createMasterDataTabs,
  createWasteManagementMasterDataTranslations,
} from './plugin.translations.shared.master-data.js';

export const wasteManagementPluginTranslationsENMasterData = createWasteManagementMasterDataTranslations({
  meta: {
    fractionCount: '{{value}} fractions',
    regionCount: '{{value}} regions',
    cityCount: '{{value}} cities',
    streetCount: '{{value}} streets',
    houseNumberCount: '{{value}} house numbers',
    collectionLocationCount: '{{value}} collection locations',
  },
  messages: {
    loading: 'Loading master data.',
    loadError: 'Waste master data could not be loaded.',
    loadForbidden: 'Missing permission for waste master data.',
    emptyTitle: 'No master data found',
    emptyBody: 'Adjust the filters or create the first waste fraction.',
  },
  tabs: createMasterDataTabs('Master-data areas', 'Fractions', 'Locations'),
  locationsWorkspace: wasteManagementPluginTranslationsENMasterDataLocationsWorkspace,
  fractions: wasteManagementPluginTranslationsENMasterDataFractions,
  ...wasteManagementPluginTranslationsENMasterDataEntities,
});
