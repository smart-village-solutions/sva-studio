import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { WasteMasterDataDialogs } from './waste-management.master-data-dialogs.js';
import { WasteMasterDataEmptyState } from './waste-management.master-data-empty-state.js';
import { WasteMasterDataLocationsContent } from './waste-management.master-data-locations-content.js';
import { WasteMasterDataSummaryContent } from './waste-management.master-data-summary-content.js';
import { StatusNotice } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteMasterDataPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteMasterDataController(pt, search);

  if (controller.loading) {
    return <StudioLoadingState>{pt('masterData.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = <WasteMasterDataDialogs controller={controller} />;

  if (
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
          onOpenCreateFraction={controller.openCreateDialog}
          onOpenCreateLocation={controller.openCreateLocationDialog}
        />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <StatusNotice message={controller.message} />
        <WasteMasterDataSummaryContent
          fractions={controller.filteredFractions}
          regions={controller.filteredRegions}
          cities={controller.filteredCities}
          streets={controller.filteredStreets}
          houseNumbers={controller.filteredHouseNumbers}
          onOpenCreateFraction={controller.openCreateDialog}
          onOpenCreateRegion={controller.openCreateRegionDialog}
          onOpenCreateCity={controller.openCreateCityDialog}
          onOpenCreateStreet={controller.openCreateStreetDialog}
          onOpenCreateHouseNumber={controller.openCreateHouseNumberDialog}
          onOpenEditFraction={controller.openEditDialog}
          onOpenEditRegion={controller.openEditRegionDialog}
          onOpenEditCity={controller.openEditCityDialog}
          onOpenEditStreet={controller.openEditStreetDialog}
          onOpenEditHouseNumber={controller.openEditHouseNumberDialog}
        />
        <WasteMasterDataLocationsContent
          collectionLocations={controller.filteredCollectionLocations}
          selectedLocationIds={controller.selectedLocationIds}
          selectedCollectionLocationsCount={controller.selectedCollectionLocations.length}
          allFilteredLocationsSelected={controller.allFilteredLocationsSelected}
          availableTours={controller.availableTours}
          onToggleSelectAll={controller.toggleSelectAllFilteredLocations}
          onToggleLocation={controller.toggleLocationSelection}
          onOpenCreateLocation={controller.openCreateLocationDialog}
          onOpenBulkAssignments={controller.openBulkAssignmentsDialog}
          onOpenEditLocation={controller.openEditLocationDialog}
          getLocationLabel={controller.getLocationLabel}
        />
      </div>
      {dialogs}
    </>
  );
};
