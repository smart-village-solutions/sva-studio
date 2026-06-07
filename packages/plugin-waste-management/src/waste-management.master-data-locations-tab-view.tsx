import { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { WasteMasterDataLocationFormContent } from './waste-management.master-data-location-form-content.js';
import { useWasteLocationsTabNavigation } from './waste-management.master-data-locations-tab-view.helpers.js';
import { WasteMasterDataLocationsWorkspace } from './waste-management.master-data-locations-workspace.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteMasterDataController = ReturnType<typeof useWasteMasterDataController>;
type WasteMasterDataLocationsTabViewProps = {
  readonly controller: WasteMasterDataController;
  readonly search: WasteManagementSearchParams;
};

export const WasteMasterDataLocationsTabView = ({
  controller,
  search,
}: WasteMasterDataLocationsTabViewProps) => {
  const navigation = useWasteLocationsTabNavigation(controller, search);

  if (search.locationsView !== 'list') {
    return (
      <WasteMasterDataLocationFormContent
        mode={search.locationsView === 'edit' ? 'edit' : 'create'}
        form={controller.locationForm}
        regions={controller.overview?.regions ?? []}
        cities={controller.overview?.cities ?? []}
        streets={controller.overview?.streets ?? []}
        houseNumbers={controller.overview?.houseNumbers ?? []}
        fractions={controller.overview?.fractions ?? []}
        availableTours={controller.availableTours}
        locationTourLinks={controller.overview?.locationTourLinks ?? []}
        saving={controller.saving}
        onChange={(patch) => controller.setLocationForm((current) => ({ ...current, ...patch }))}
        onCancel={navigation.toList}
        onSubmit={(values) => controller.onSubmitLocation(values, search.locationsView === 'edit' ? 'edit' : 'create')}
        onReloadAssignments={() => controller.reloadOverview()}
      />
    );
  }

  return (
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
      page={search.page}
      pageSize={search.pageSize}
      selectedTourId={search.tourId}
      onTourFilterChange={navigation.setTourFilter}
      onPageChange={navigation.setPage}
      onSyncPageChange={navigation.syncPage}
      onPageSizeChange={navigation.setPageSize}
      onToggleSelectAll={controller.toggleSelectAllFilteredLocations}
      onToggleLocation={controller.toggleLocationSelection}
      onOpenCreateRegion={controller.openCreateRegionDialog}
      onOpenCreateCity={controller.openCreateCityDialog}
      onOpenCreateStreet={controller.openCreateStreetDialog}
      onOpenCreateHouseNumber={controller.openCreateHouseNumberDialog}
      onOpenCreateLocation={navigation.toCreate}
      onOpenEditRegion={controller.openEditRegionDialog}
      onOpenEditCity={controller.openEditCityDialog}
      onOpenEditStreet={controller.openEditStreetDialog}
      onOpenEditHouseNumber={controller.openEditHouseNumberDialog}
      onOpenBulkAssignments={controller.openBulkAssignmentsDialog}
      onCopyLocation={navigation.toCopy}
      onDeleteLocation={controller.onDeleteLocation}
      onDeleteLocations={controller.onDeleteLocations}
      onOpenEditLocation={navigation.toEdit}
      getLocationLabel={controller.getLocationLabel}
    />
  );
};
