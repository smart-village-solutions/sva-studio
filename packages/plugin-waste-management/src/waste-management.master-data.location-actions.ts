import type { WasteCollectionLocationRecord } from '@sva/plugin-sdk';

import {
  wasteMasterDataFormDefaults,
  wasteMasterDataFormMappers,
} from './waste-management.master-data.forms.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

const resolveKnownFilteredLocationIds = (state: WasteMasterDataState): readonly string[] => {
  if (state.filteredLocationIds.length > 0) return state.filteredLocationIds;
  const page = state.collectionLocationPage;
  if (!page || page.total === 0 || page.items.length !== page.total) return [];
  return page.items.map((location) => location.id);
};

export const createWasteMasterDataLocationActions = (
  state: WasteMasterDataState,
  search: WasteManagementSearchParams,
  loadFilteredLocationIds: () => Promise<readonly string[] | null>,
  clearFilteredLocationIds: () => void
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
      tourId: state.availableTours.length === 1 ? (state.availableTours[0]?.id ?? '') : '',
    });
    state.setMessage(null);
    state.setBulkAssignmentsDialogOpen(true);
  },
  toggleLocationSelection: (locationId: string, checked: boolean) =>
    state.setSelectedLocationIds((current) =>
      checked
        ? current.includes(locationId)
          ? current
          : [...current, locationId]
        : current.filter((id) => id !== locationId)
    ),
  replaceLocationSelection: (locationIds: readonly string[]) =>
    state.setSelectedLocationIds(Array.from(new Set(locationIds))),
  toggleSelectAllFilteredLocations: async (checked: boolean) => {
    const filteredLocationIds = checked
      ? await loadFilteredLocationIds()
      : resolveKnownFilteredLocationIds(state);
    if (filteredLocationIds === null) return;
    if (!checked) clearFilteredLocationIds();
    state.setSelectedLocationIds((current) => {
      if (!checked) {
        const filteredIds = new Set(filteredLocationIds);
        return current.filter((id) => !filteredIds.has(id));
      }
      const merged = new Set(current);
      for (const locationId of filteredLocationIds) {
        merged.add(locationId);
      }
      return Array.from(merged);
    });
  },
});
