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
      void navigate({ to: '/plugins/waste-management', search: { ...search, locationsView: 'list' } });
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
      void navigate({ to: '/plugins/waste-management', search: { ...search, locationsView: 'create' } });
    },
    toEdit: (location: Parameters<typeof wasteMasterDataFormMappers.collectionLocationToForm>[0]) => {
      controller.setLocationDialogMode('edit');
      controller.setLocationDialogOpen(false);
      controller.setLocationForm(wasteMasterDataFormMappers.collectionLocationToForm(location));
      controller.setMessage(null);
      void navigate({ to: '/plugins/waste-management', search: { ...search, locationsView: 'edit' } });
    },
    setTourFilter: (tourId: string) => {
      void navigate({ to: '/plugins/waste-management', search: { ...search, tourId: tourId || undefined } });
    },
    setPage: (page: number) => {
      void navigate({ to: '/plugins/waste-management', search: { ...search, page } });
    },
    setPageSize: (pageSize: number) => {
      void navigate({ to: '/plugins/waste-management', search: { ...search, page: 1, pageSize } });
    },
  };
};
