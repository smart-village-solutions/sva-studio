import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import {
  wasteMasterDataFormDefaults,
  wasteMasterDataFormMappers,
} from './waste-management.master-data.forms.js';
import { toWasteTourEditSearch } from './waste-management.cross-link.navigation.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { matchesLocationTourFilters } from './waste-management.master-data-locations-table.helpers.js';

type WasteViewModel = ReturnType<typeof useWasteMasterDataViewModel>;
type WasteNavigate = ReturnType<typeof useNavigate>;
type WasteLocation = Parameters<typeof wasteMasterDataFormMappers.collectionLocationToForm>[0];

const createLocationFormNavigation = (
  controller: WasteViewModel,
  search: WasteManagementSearchParams,
  navigate: WasteNavigate
) => ({
  resetFilters: () =>
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        q: '',
        status: 'all',
        regionId: undefined,
        cityId: undefined,
        locationStreetId: undefined,
        locationHouseNumberId: undefined,
        tourId: undefined,
        locationYear: undefined,
        locationTourStatus: undefined,
        page: 1,
      },
    }),
  toList: () => {
    controller.setLocationDialogOpen(false);
    controller.resetLocationForm();
    controller.setMessage(null);
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: { ...search, locationsView: 'list', collectionLocationId: undefined },
    });
  },
  toCreate: () => {
    controller.setLocationDialogMode('create');
    controller.setLocationDialogOpen(false);
    controller.setLocationForm({
      ...wasteMasterDataFormDefaults.createCollectionLocation(),
      regionId: search.regionId ?? '',
      cityId: search.cityId ?? '',
    });
    controller.setMessage(null);
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: { ...search, locationsView: 'create', collectionLocationId: undefined },
    });
  },
  toEdit: (location: WasteLocation) => {
    controller.setLocationDialogMode('edit');
    controller.setLocationDialogOpen(false);
    controller.setLocationForm(wasteMasterDataFormMappers.collectionLocationToForm(location));
    controller.setMessage(null);
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: { ...search, locationsView: 'edit', collectionLocationId: location.id },
    });
  },
  toCopy: (location: WasteLocation) => {
    controller.setLocationDialogMode('create');
    controller.setLocationDialogOpen(false);
    controller.setLocationForm({
      ...wasteMasterDataFormDefaults.createCollectionLocation(),
      regionId: location.regionId ?? '',
      cityId: location.cityId,
      streetId: location.streetId ?? '',
      houseNumberId: location.houseNumberId ?? '',
      active: location.active,
    });
    controller.setMessage(null);
    controller.setLastOutcome(null);
    void navigate({
      to: '/plugins/waste-management',
      search: { ...search, locationsView: 'create', collectionLocationId: undefined },
    });
  },
});

const createLocationListNavigation = (
  search: WasteManagementSearchParams,
  navigate: WasteNavigate,
  availableTours: WasteViewModel['availableTours']
) => ({
  applyFilters: (patch: Partial<WasteManagementSearchParams>) =>
    void navigate({
      to: '/plugins/waste-management',
      search: (current: WasteManagementSearchParams) => {
        const next = { ...current, ...patch, page: 1 };
        const scopeChanged =
          next.locationYear !== current.locationYear ||
          next.locationTourStatus !== current.locationTourStatus;
        if (!scopeChanged || !next.tourId) return next;
        const selectedTour = availableTours.find((tour) => tour.id === next.tourId);
        return selectedTour &&
          matchesLocationTourFilters(selectedTour, next.locationYear, next.locationTourStatus)
          ? next
          : { ...next, tourId: undefined };
      },
    }),
  setQuery: (q: string) =>
    void navigate({
      to: '/plugins/waste-management',
      search: { ...search, q, page: 1 },
      replace: true,
    }),
  toEditTour: (tourId: string) =>
    void navigate({
      to: '/plugins/waste-management',
      search: toWasteTourEditSearch(search, tourId),
    }),
  setPage: (page: number) =>
    void navigate({ to: '/plugins/waste-management', search: { ...search, page } }),
  syncPage: (page: number) =>
    void navigate({
      to: '/plugins/waste-management',
      search: { ...search, page },
      replace: true,
    }),
  setPageSize: (pageSize: number) =>
    void navigate({
      to: '/plugins/waste-management',
      search: { ...search, page: 1, pageSize },
    }),
});

export const useWasteLocationsTabNavigation = (
  controller: WasteViewModel,
  search: WasteManagementSearchParams
) => {
  const navigate = useNavigate();
  return {
    ...createLocationFormNavigation(controller, search, navigate),
    ...createLocationListNavigation(search, navigate, controller.availableTours),
  };
};
