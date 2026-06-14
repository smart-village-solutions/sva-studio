import type { WasteCityRecord, WasteFractionRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/plugin-sdk';

import { wasteMasterDataFormDefaults, wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const createWasteMasterDataEntityActions = (
  state: WasteMasterDataState,
  search: WasteManagementSearchParams
) => ({
  openCreateDialog: () => {
    state.setDialogMode('create');
    state.setFractionForm(wasteMasterDataFormDefaults.createFraction());
    state.setMessage(null);
    state.setDialogOpen(true);
  },
  openEditDialog: (fraction: WasteFractionRecord) => {
    state.setDialogMode('edit');
    state.setFractionForm(wasteMasterDataFormMappers.fractionToForm(fraction));
    state.setMessage(null);
    state.setDialogOpen(true);
  },
  openCreateRegionDialog: () => {
    state.setRegionDialogMode('create');
    state.setRegionForm(wasteMasterDataFormDefaults.createRegion());
    state.setMessage(null);
    state.setRegionDialogOpen(true);
  },
  openEditRegionDialog: (region: WasteRegionRecord) => {
    state.setRegionDialogMode('edit');
    state.setRegionForm(wasteMasterDataFormMappers.regionToForm(region));
    state.setMessage(null);
    state.setRegionDialogOpen(true);
  },
  openCreateCityDialog: () => {
    state.setCityDialogMode('create');
    state.setCityForm({
      ...wasteMasterDataFormDefaults.createCity(),
      regionId: state.overview?.regions.length === 1 ? state.overview.regions[0]?.id ?? '' : '',
    });
    state.setMessage(null);
    state.setCityDialogOpen(true);
  },
  openEditCityDialog: (city: WasteCityRecord) => {
    state.setCityDialogMode('edit');
    state.setCityForm(wasteMasterDataFormMappers.cityToForm(city));
    state.setMessage(null);
    state.setCityDialogOpen(true);
  },
  openCreateStreetDialog: () => {
    state.setStreetDialogMode('create');
    state.setStreetForm({
      ...wasteMasterDataFormDefaults.createStreet(),
      cityId: search.cityId ?? (state.overview?.cities.length === 1 ? state.overview.cities[0]?.id ?? '' : ''),
    });
    state.setMessage(null);
    state.setStreetDialogOpen(true);
  },
  openEditStreetDialog: (street: WasteStreetRecord) => {
    state.setStreetDialogMode('edit');
    state.setStreetForm(wasteMasterDataFormMappers.streetToForm(street));
    state.setMessage(null);
    state.setStreetDialogOpen(true);
  },
  openCreateHouseNumberDialog: () => {
    state.setHouseNumberDialogMode('create');
    state.setHouseNumberForm({
      ...wasteMasterDataFormDefaults.createHouseNumber(),
      streetId: state.overview?.streets.length === 1 ? state.overview.streets[0]?.id ?? '' : '',
    });
    state.setMessage(null);
    state.setHouseNumberDialogOpen(true);
  },
  openEditHouseNumberDialog: (houseNumber: WasteHouseNumberRecord) => {
    state.setHouseNumberDialogMode('edit');
    state.setHouseNumberForm(wasteMasterDataFormMappers.houseNumberToForm(houseNumber));
    state.setMessage(null);
    state.setHouseNumberDialogOpen(true);
  },
});
