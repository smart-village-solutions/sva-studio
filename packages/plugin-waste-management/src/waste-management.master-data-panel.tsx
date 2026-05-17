import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { WasteMasterDataDialogs } from './waste-management.master-data-dialogs.js';
import { WasteMasterDataPanelEmptyState } from './waste-management.master-data-panel.empty-state.js';
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
        <WasteMasterDataPanelEmptyState controller={controller} search={search} />
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
