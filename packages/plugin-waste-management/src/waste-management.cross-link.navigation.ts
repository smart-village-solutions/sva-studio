import type { WasteManagementSearchParams } from './search-params.js';

const resetEntityEditSearch = (
  search: WasteManagementSearchParams
): WasteManagementSearchParams => ({
  ...search,
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  wasteFractionId: undefined,
  tourId: undefined,
  duplicateFromTourId: undefined,
  collectionLocationId: undefined,
  page: 1,
});

export const toWasteTourEditSearch = (
  search: WasteManagementSearchParams,
  tourId: string
): WasteManagementSearchParams => ({
  ...resetEntityEditSearch(search),
  tab: 'tours',
  toursView: 'edit',
  tourId,
});

export const toWasteFractionEditSearch = (
  search: WasteManagementSearchParams,
  wasteFractionId: string
): WasteManagementSearchParams => ({
  ...resetEntityEditSearch(search),
  tab: 'fractions',
  masterDataTab: 'fractions',
  fractionsView: 'edit',
  wasteFractionId,
});

export const toWasteCollectionLocationEditSearch = (
  search: WasteManagementSearchParams,
  collectionLocationId: string
): WasteManagementSearchParams => ({
  ...resetEntityEditSearch(search),
  tab: 'locations',
  masterDataTab: 'locations',
  locationsView: 'edit',
  collectionLocationId,
});
