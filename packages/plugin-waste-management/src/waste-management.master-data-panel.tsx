import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { wasteMasterDataFormDefaults } from './waste-management.master-data.forms.js';
import { WasteMasterDataDialogs } from './waste-management.master-data-dialogs.js';
import { WasteMasterDataEmptyState } from './waste-management.master-data-empty-state.js';
import { WasteMasterDataTabContent } from './waste-management.master-data-tab-content.js';
import { StatusNotice } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteMasterDataPanel = ({
  search,
  tab,
}: {
  readonly search: WasteManagementSearchParams;
  readonly tab: WasteManagementSearchParams['masterDataTab'];
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteMasterDataController(pt, search);

  if (controller.loading) {
    return <StudioLoadingState>{pt('masterData.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = <WasteMasterDataDialogs controller={controller} />;
  const showFractionFormView = tab === 'fractions' && search.fractionsView !== 'list';
  const showLocationFormView = tab === 'locations' && search.locationsView !== 'list';

  if (
    !showFractionFormView &&
    !showLocationFormView &&
    !controller.filteredFractions.length &&
    !controller.filteredRegions.length &&
    !controller.filteredCities.length &&
    !controller.filteredStreets.length &&
    !controller.filteredHouseNumbers.length &&
    !controller.filteredCollectionLocations.length
  ) {
    return (
      <>
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
        {dialogs}
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <StatusNotice message={controller.message} />
        <WasteMasterDataTabContent controller={controller} search={search} tab={tab} />
      </div>
      {dialogs}
    </>
  );
};
