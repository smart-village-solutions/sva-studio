import type { WasteCollectionLocationRecord } from '@sva/core';
import { useEffect } from 'react';

import {
  getWasteManagementMasterDataOverview,
  getWasteManagementToursOverview,
} from './waste-management.api.js';
import {
  wasteMasterDataFormDefaults,
} from './waste-management.master-data.forms.js';
import { createWasteMasterDataDialogActions, createWasteMasterDataSelectionActions } from './waste-management.master-data.actions.js';
import { wasteMasterDataPresentation } from './waste-management.master-data.presentation.js';
import { createWasteMasterDataSubmitHandlers } from './waste-management.master-data.submissions.js';
import { resolveApiErrorCode, type StatusMessage } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteMasterDataState } from './waste-management.master-data.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const useWasteMasterDataController = (pt: Translate, search: WasteManagementSearchParams) => {
  const state = useWasteMasterDataState();

  const loadOverview = async (active = true) => {
    try {
      const response = await getWasteManagementMasterDataOverview();
      if (!active) return;
      state.setOverview(response);
      state.setError(null);
    } catch (loadError) {
      if (!active) return;
      const code = resolveApiErrorCode(loadError);
      state.setError(code === 'forbidden' ? pt('masterData.messages.loadForbidden') : pt('masterData.messages.loadError'));
    } finally {
      if (active) state.setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void loadOverview(active);
    return () => {
      active = false;
    };
  }, [pt]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await getWasteManagementToursOverview();
        if (active) state.setAvailableTours(response.tours);
      } catch {
        if (active) state.setAvailableTours([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredFractions = wasteMasterDataPresentation.filterFractions(state.overview?.fractions ?? [], search);
  const filteredRegions = wasteMasterDataPresentation.filterRegions(state.overview?.regions ?? [], search);
  const filteredCities = wasteMasterDataPresentation.filterCities(state.overview?.cities ?? [], search);
  const filteredStreets = wasteMasterDataPresentation.filterStreets(state.overview?.streets ?? [], search);
  const filteredHouseNumbers = wasteMasterDataPresentation.filterHouseNumbers(state.overview?.houseNumbers ?? [], search);
  const filteredCollectionLocations = wasteMasterDataPresentation.filterCollectionLocations(
    state.overview?.collectionLocations ?? [],
    search
  );
  const selectedCollectionLocations = filteredCollectionLocations.filter((location) =>
    state.selectedLocationIds.includes(location.id)
  );
  const dialogActions = createWasteMasterDataDialogActions(state, search);
  const selectionActions = createWasteMasterDataSelectionActions(state, search, filteredCollectionLocations);
  const submitHandlers = createWasteMasterDataSubmitHandlers({
    state,
    pt,
    search,
    loadOverview,
    selectedCollectionLocationIds: selectedCollectionLocations.map((location) => location.id),
  });

  return {
    ...state,
    filteredFractions,
    filteredRegions,
    filteredCities,
    filteredStreets,
    filteredHouseNumbers,
    filteredCollectionLocations,
    selectedCollectionLocations,
    selectedLocations: wasteMasterDataPresentation.mapSelectedLocations(pt, state.overview, selectedCollectionLocations),
    allFilteredLocationsSelected:
      filteredCollectionLocations.length > 0 &&
      filteredCollectionLocations.every((location) => state.selectedLocationIds.includes(location.id)),
    getLocationLabel: (location: WasteCollectionLocationRecord) =>
      wasteMasterDataPresentation.formatCollectionLocationLabel(
        pt,
        state.overview ?? {
          fractions: [],
          regions: [],
          cities: [],
          streets: [],
          houseNumbers: [],
          collectionLocations: [],
          locationTourLinks: [],
        },
        location
      ),
    ...dialogActions,
    ...selectionActions,
    ...submitHandlers,
    resetFractionForm: () => state.setFractionForm(wasteMasterDataFormDefaults.createFraction()),
    resetRegionForm: () => state.setRegionForm(wasteMasterDataFormDefaults.createRegion()),
    resetCityForm: () => state.setCityForm(wasteMasterDataFormDefaults.createCity()),
    resetStreetForm: () => state.setStreetForm(wasteMasterDataFormDefaults.createStreet()),
    resetHouseNumberForm: () => state.setHouseNumberForm(wasteMasterDataFormDefaults.createHouseNumber()),
    resetLocationForm: () => state.setLocationForm(wasteMasterDataFormDefaults.createCollectionLocation()),
    resetBulkAssignmentsForm: () => state.setBulkAssignmentsForm(wasteMasterDataFormDefaults.createBulkAssignments()),
  };
};
