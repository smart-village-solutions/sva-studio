import { useNavigate } from '@tanstack/react-router';

import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { WasteMasterDataFractionsContent } from './waste-management.master-data-fractions-content.js';
import { WasteMasterDataLocationsWorkspace } from './waste-management.master-data-locations-workspace.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteMasterDataTabContent = ({
  controller,
  search,
  tab,
}: {
  readonly controller: ReturnType<typeof useWasteMasterDataController>;
  readonly search: WasteManagementSearchParams;
  readonly tab: WasteManagementSearchParams['masterDataTab'];
}) => {
  const navigate = useNavigate();

  return tab === 'fractions' ? (
    <WasteMasterDataFractionsContent
      fractions={controller.filteredFractions}
      fractionsSortBy={search.fractionsSortBy}
      fractionsSortDirection={search.fractionsSortDirection}
      onOpenCreateFraction={controller.openCreateDialog}
      onOpenEditFraction={controller.openEditDialog}
      onOpenDeleteFraction={(fraction) => controller.deleteFraction(fraction.id)}
      onFractionsSortChange={(sortBy, sortDirection) => {
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            fractionsSortBy: sortBy,
            fractionsSortDirection: sortDirection,
          },
        });
      }}
    />
  ) : (
    <WasteMasterDataLocationsWorkspace
      regions={controller.filteredRegions}
      cities={controller.filteredCities}
      streets={controller.filteredStreets}
      houseNumbers={controller.filteredHouseNumbers}
      collectionLocations={controller.filteredCollectionLocations}
      locationTourLinks={controller.overview?.locationTourLinks ?? []}
      selectedLocationIds={controller.selectedLocationIds}
      allFilteredLocationsSelected={controller.allFilteredLocationsSelected}
      selectedCollectionLocationsCount={controller.selectedCollectionLocations.length}
      availableTours={controller.availableTours}
      selectedTourId={search.tourId}
      onTourFilterChange={(tourId) => {
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            tourId: tourId || undefined,
          },
        });
      }}
      onToggleSelectAll={controller.toggleSelectAllFilteredLocations}
      onToggleLocation={controller.toggleLocationSelection}
      onOpenCreateRegion={controller.openCreateRegionDialog}
      onOpenCreateCity={controller.openCreateCityDialog}
      onOpenCreateStreet={controller.openCreateStreetDialog}
      onOpenCreateHouseNumber={controller.openCreateHouseNumberDialog}
      onOpenCreateLocation={controller.openCreateLocationDialog}
      onOpenEditRegion={controller.openEditRegionDialog}
      onOpenEditCity={controller.openEditCityDialog}
      onOpenEditStreet={controller.openEditStreetDialog}
      onOpenEditHouseNumber={controller.openEditHouseNumberDialog}
      onOpenBulkAssignments={controller.openBulkAssignmentsDialog}
      onOpenEditLocation={controller.openEditLocationDialog}
      getLocationLabel={controller.getLocationLabel}
    />
  );
};
