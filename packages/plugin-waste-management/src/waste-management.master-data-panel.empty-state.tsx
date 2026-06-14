import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import { wasteMasterDataFormDefaults } from './waste-management.master-data.forms.js';
import { WasteMasterDataEmptyState } from './waste-management.master-data-empty-state.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteViewModel = ReturnType<typeof useWasteMasterDataViewModel>;

export const WasteMasterDataPanelEmptyState = ({
  controller,
  search,
}: {
  readonly controller: WasteViewModel;
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
