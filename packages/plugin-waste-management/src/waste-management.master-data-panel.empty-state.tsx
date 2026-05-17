import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { wasteMasterDataFormDefaults } from './waste-management.master-data.forms.js';
import { WasteMasterDataEmptyState } from './waste-management.master-data-empty-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteMasterDataController = ReturnType<typeof useWasteMasterDataController>;

export const WasteMasterDataPanelEmptyState = ({
  controller,
  search,
}: {
  readonly controller: WasteMasterDataController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  return (
    <WasteMasterDataEmptyState
      onOpenCreateFraction={() => {
        controller.setDialogMode('create');
        controller.setDialogOpen(false);
        controller.resetFractionForm();
        controller.setMessage(null);
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            fractionsView: 'create',
          },
        });
      }}
      onOpenCreateLocation={() => {
        controller.setLocationDialogMode('create');
        controller.setLocationDialogOpen(false);
        controller.setLocationForm({
          ...wasteMasterDataFormDefaults.createCollectionLocation(),
          regionId: search.regionId ?? '',
          cityId: search.cityId ?? '',
        });
        controller.setMessage(null);
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            locationsView: 'create',
          },
        });
      }}
    />
  );
};
