import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { wasteMasterDataFormDefaults, wasteMasterDataFormMappers } from './waste-management.master-data.forms.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteMasterDataController = ReturnType<typeof useWasteMasterDataController>;

export const useWasteLocationsTabNavigation = (controller: WasteMasterDataController, search: WasteManagementSearchParams) => {
  const navigate = useNavigate();

  return {
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
    toEdit: (location: Parameters<typeof wasteMasterDataFormMappers.collectionLocationToForm>[0]) => {
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
    toCopy: (location: Parameters<typeof wasteMasterDataFormMappers.collectionLocationToForm>[0]) => {
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
    setTourFilter: (tourId: string) => {
      void navigate({ to: '/plugins/waste-management', search: { ...search, tourId: tourId || undefined } });
    },
    setPage: (page: number) => {
      void navigate({ to: '/plugins/waste-management', search: { ...search, page } });
    },
    syncPage: (page: number) => {
      void navigate({ to: '/plugins/waste-management', search: { ...search, page }, replace: true });
    },
    setPageSize: (pageSize: number) => {
      void navigate({ to: '/plugins/waste-management', search: { ...search, page: 1, pageSize } });
    },
  };
};
