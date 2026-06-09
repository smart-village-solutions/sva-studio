import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { WasteMasterDataDialogs } from './waste-management.master-data-dialogs.js';
import { WasteMasterDataPanelEmptyState } from './waste-management.master-data-panel.empty-state.js';
import { WasteMasterDataTabContent } from './waste-management.master-data-tab-content.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

const hasAnyMasterData = (
  overview: ReturnType<typeof useWasteMasterDataController>['overview']
): boolean =>
  Boolean(
    overview &&
      (
        overview.fractions.length > 0 ||
        overview.regions.length > 0 ||
        overview.cities.length > 0 ||
        overview.streets.length > 0 ||
        overview.houseNumbers.length > 0 ||
        overview.collectionLocations.length > 0
      )
  );

const retrySyncWasteTypes = async (
  controller: ReturnType<typeof useWasteMasterDataController>,
  action: NonNullable<StatusMessage['retryAction']>
) => {
  if (action === 'sync-waste-types') {
    await controller.retrySyncWasteTypes();
  }
};

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
  const showEmptyState = !showFractionFormView && !showLocationFormView && !hasAnyMasterData(controller.overview);

  if (showEmptyState) {
    return (
      <>
        <div className="space-y-4">
          <StatusNotice message={controller.message} onRetry={(action) => void retrySyncWasteTypes(controller, action)} />
        </div>
        <WasteMasterDataPanelEmptyState controller={controller} search={search} />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <StatusNotice message={controller.message} onRetry={(action) => void retrySyncWasteTypes(controller, action)} />
        <WasteMasterDataTabContent controller={controller} search={search} tab={tab} />
      </div>
      {dialogs}
    </>
  );
};
