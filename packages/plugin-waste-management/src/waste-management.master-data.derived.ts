import type { WasteCollectionLocationRecord, WasteManagementMasterDataOverview } from '@sva/plugin-sdk';

import { wasteMasterDataPresentation } from './waste-management.master-data.presentation.js';
import { wasteMasterDataFormDefaults } from './waste-management.master-data.forms.js';
import type { WasteMasterDataState } from './waste-management.master-data.state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const emptyOverview: WasteManagementMasterDataOverview = {
  fractions: [],
  regions: [],
  cities: [],
  streets: [],
  houseNumbers: [],
  collectionLocations: [],
  locationTourLinks: [],
};

export const createWasteMasterDataDerivedState = (
  state: WasteMasterDataState,
  pt: Translate,
  search: WasteManagementSearchParams
) => {
  const overview = state.overview ?? emptyOverview;
  const filteredCollectionLocations = wasteMasterDataPresentation.filterCollectionLocations(
    overview.collectionLocations,
    search,
    overview.locationTourLinks
  );
  const selectedCollectionLocations = filteredCollectionLocations.filter((location) =>
    state.selectedLocationIds.includes(location.id)
  );

  return {
    filteredFractions: wasteMasterDataPresentation.filterFractions(overview.fractions, search),
    filteredRegions: wasteMasterDataPresentation.filterRegions(overview.regions, search),
    filteredCities: wasteMasterDataPresentation.filterCities(overview.cities, search),
    filteredStreets: wasteMasterDataPresentation.filterStreets(overview.streets, search),
    filteredHouseNumbers: wasteMasterDataPresentation.filterHouseNumbers(overview.houseNumbers, search),
    filteredCollectionLocations,
    selectedCollectionLocations,
    selectedLocations: wasteMasterDataPresentation.mapSelectedLocations(pt, state.overview, selectedCollectionLocations),
    allFilteredLocationsSelected:
      filteredCollectionLocations.length > 0 &&
      filteredCollectionLocations.every((location) => state.selectedLocationIds.includes(location.id)),
    getLocationLabel: (location: WasteCollectionLocationRecord) =>
      wasteMasterDataPresentation.formatCollectionLocationLabel(pt, overview, location),
  };
};

export const createWasteMasterDataResetActions = (state: WasteMasterDataState) => ({
  resetFractionForm: () => state.setFractionForm(wasteMasterDataFormDefaults.createFraction()),
  resetRegionForm: () => state.setRegionForm(wasteMasterDataFormDefaults.createRegion()),
  resetCityForm: () => state.setCityForm(wasteMasterDataFormDefaults.createCity()),
  resetStreetForm: () => state.setStreetForm(wasteMasterDataFormDefaults.createStreet()),
  resetHouseNumberForm: () => state.setHouseNumberForm(wasteMasterDataFormDefaults.createHouseNumber()),
  resetLocationForm: () => state.setLocationForm(wasteMasterDataFormDefaults.createCollectionLocation()),
  resetBulkAssignmentsForm: () => state.setBulkAssignmentsForm(wasteMasterDataFormDefaults.createBulkAssignments()),
});
