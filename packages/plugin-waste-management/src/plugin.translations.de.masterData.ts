import { wasteManagementPluginTranslationsDEMasterDataEntities } from './plugin.translations.de.masterData.entities.js';
import { wasteManagementPluginTranslationsDEMasterDataFractions } from './plugin.translations.de.masterData.fractions.js';
import { wasteManagementPluginTranslationsDEMasterDataLocationsWorkspace } from './plugin.translations.de.masterData.locations-workspace.js';
import {
  createMasterDataTabs,
  createWasteManagementMasterDataTranslations,
} from './plugin.translations.shared.master-data.js';

export const wasteManagementPluginTranslationsDEMasterData = createWasteManagementMasterDataTranslations({
  meta: {
    fractionCount: '{{value}} Fraktionen',
    regionCount: '{{value}} Regionen',
    cityCount: '{{value}} Orte',
    streetCount: '{{value}} Straßen',
    houseNumberCount: '{{value}} Hausnummern',
    collectionLocationCount: '{{value}} Abholorte',
  },
  messages: {
    loading: 'Stammdaten werden geladen.',
    loadError: 'Die Abfall-Stammdaten konnten nicht geladen werden.',
    loadForbidden: 'Für die Abfall-Stammdaten fehlt die Berechtigung.',
    emptyTitle: 'Keine Stammdaten gefunden',
    emptyBody: 'Passen Sie die Filter an oder legen Sie die erste Abfallfraktion an.',
  },
  tabs: createMasterDataTabs('Stammdatenbereiche', 'Fraktionen', 'Abholorte'),
  locationsWorkspace: wasteManagementPluginTranslationsDEMasterDataLocationsWorkspace,
  fractions: wasteManagementPluginTranslationsDEMasterDataFractions,
  ...wasteManagementPluginTranslationsDEMasterDataEntities,
});
