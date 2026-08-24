import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import { WasteMasterDataLocationFormContent } from './waste-management.master-data-location-form-content.js';
import { useWasteLocationsTabNavigation } from './waste-management.master-data-locations-tab-view.helpers.js';
import { WasteMasterDataLocationsWorkspace } from './waste-management.master-data-locations-workspace.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteViewModel = ReturnType<typeof useWasteMasterDataViewModel>;
type WasteMasterDataLocationsTabViewProps = {
  readonly controller: WasteViewModel;
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
        onSubmit={(values, cityPostalCodeUpdate) =>
          controller.onSubmitLocation(
            values,
            search.locationsView === 'edit' ? 'edit' : 'create',
            cityPostalCodeUpdate
          )
        }
        onReloadAssignments={() => controller.reloadOverview()}
      />
    );
  }

  return (
    <WasteMasterDataLocationsWorkspace
      fractions={controller.overview?.fractions ?? []}
      auditCollectionLocations={controller.overview?.collectionLocations ?? []}
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
      pageCount={controller.collectionLocationPage?.pageCount ?? 0}
      totalItems={controller.collectionLocationPage?.total ?? 0}
      sortMode={search.locationSortMode}
      sortDirection={search.locationSortDirection}
      selectedTourId={search.tourId}
      onTourFilterChange={navigation.setTourFilter}
      onPageChange={navigation.setPage}
      onSyncPageChange={navigation.syncPage}
      onPageSizeChange={navigation.setPageSize}
      onSortModeChange={navigation.setSortMode}
      onSortDirectionChange={navigation.setSortDirection}
      onToggleSelectAll={controller.toggleSelectAllFilteredLocations}
      onToggleLocation={controller.toggleLocationSelection}
      onReplaceLocationSelection={controller.replaceLocationSelection}
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
      onOpenEditTour={navigation.toEditTour}
      getLocationLabel={controller.getLocationLabel}
    />
  );
};
