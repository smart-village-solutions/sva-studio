import type { WasteCollectionLocationRecord } from '@sva/plugin-sdk';

import { wasteMasterDataFormDefaults, wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import type { WasteMasterDataState } from './waste-management.master-data.state.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const createWasteMasterDataLocationActions = (
  state: WasteMasterDataState,
  search: WasteManagementSearchParams,
  filteredCollectionLocations: readonly WasteCollectionLocationRecord[]
) => ({
  openCreateLocationDialog: () => {
    state.setLocationDialogMode('create');
    state.setLocationForm({
      ...wasteMasterDataFormDefaults.createCollectionLocation(),
      regionId: search.regionId ?? '',
      cityId: search.cityId ?? '',
    });
    state.setMessage(null);
    state.setLocationDialogOpen(true);
  },
  openEditLocationDialog: (location: WasteCollectionLocationRecord) => {
    state.setLocationDialogMode('edit');
    state.setLocationForm(wasteMasterDataFormMappers.collectionLocationToForm(location));
    state.setMessage(null);
    state.setLocationDialogOpen(true);
  },
  openBulkAssignmentsDialog: () => {
    state.setBulkAssignmentsForm({
      ...wasteMasterDataFormDefaults.createBulkAssignments(),
      tourId: state.availableTours.length === 1 ? state.availableTours[0]?.id ?? '' : '',
    });
    state.setMessage(null);
    state.setBulkAssignmentsDialogOpen(true);
  },
  toggleLocationSelection: (locationId: string, checked: boolean) =>
    state.setSelectedLocationIds((current) =>
      checked ? (current.includes(locationId) ? current : [...current, locationId]) : current.filter((id) => id !== locationId)
    ),
  toggleSelectAllFilteredLocations: (checked: boolean) =>
    state.setSelectedLocationIds((current) => {
      if (!checked) {
        const filteredIds = new Set(filteredCollectionLocations.map((location) => location.id));
        return current.filter((id) => !filteredIds.has(id));
      }
      const merged = new Set(current);
      for (const location of filteredCollectionLocations) {
        merged.add(location.id);
      }
      return Array.from(merged);
    }),
});
