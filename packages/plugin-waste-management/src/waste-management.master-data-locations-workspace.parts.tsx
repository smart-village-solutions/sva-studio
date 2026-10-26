import { WasteMasterDataLocationsTable } from './waste-management.master-data-locations-table.js';
import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';

export const WasteMasterDataLocationsTableSection = ({
  regions,
  search,
  onQueryChange,
  onResetFilters,
  cities,
  streets,
  houseNumbers,
  collectionLocations,
  locationTourLinks,
  selectedLocationIds,
  allFilteredLocationsSelected,
  selectedCollectionLocationsCount,
  availableTours,
  locationYear,
  onLocationYearChange,
  locationTourStatus,
  onLocationTourStatusChange,
  page,
  pageSize,
  sortMode,
  sortDirection,
  pageCount,
  totalItems,
  selectedTourId,
  onPageChange,
  onPageSizeChange,
  onSortModeChange,
  onSortDirectionChange,
  onTourFilterChange,
  onToggleSelectAll,
  onToggleLocation,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
  onOpenBulkAssignments,
  onCopyLocation,
  onDeleteLocation,
  onDeleteLocations,
  onOpenEditLocation,
  onOpenEditTour,
  getLocationLabel,
}: Pick<
  WasteMasterDataLocationsWorkspaceProps,
  | 'regions'
  | 'search'
  | 'onQueryChange'
  | 'onResetFilters'
  | 'cities'
  | 'streets'
  | 'houseNumbers'
  | 'collectionLocations'
  | 'locationTourLinks'
  | 'selectedLocationIds'
  | 'allFilteredLocationsSelected'
  | 'selectedCollectionLocationsCount'
  | 'availableTours'
  | 'locationYear'
  | 'onLocationYearChange'
  | 'locationTourStatus'
  | 'onLocationTourStatusChange'
  | 'selectedTourId'
  | 'onPageChange'
  | 'onPageSizeChange'
  | 'sortMode'
  | 'sortDirection'
  | 'onSortModeChange'
  | 'onSortDirectionChange'
  | 'onTourFilterChange'
  | 'onToggleSelectAll'
  | 'onToggleLocation'
  | 'onOpenCreateRegion'
  | 'onOpenCreateCity'
  | 'onOpenCreateStreet'
  | 'onOpenCreateHouseNumber'
  | 'onOpenCreateLocation'
  | 'onOpenBulkAssignments'
  | 'onCopyLocation'
  | 'onDeleteLocation'
  | 'onDeleteLocations'
  | 'onOpenEditLocation'
  | 'onOpenEditTour'
  | 'getLocationLabel'
> & {
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalItems: number;
}) => (
  <WasteMasterDataLocationsTable
    search={search}
    onQueryChange={onQueryChange}
    onResetFilters={onResetFilters}
    regions={regions}
    cities={cities}
    streets={streets}
    houseNumbers={houseNumbers}
    collectionLocations={collectionLocations}
    locationTourLinks={locationTourLinks}
    selectedLocationIds={selectedLocationIds}
    allFilteredLocationsSelected={allFilteredLocationsSelected}
    selectedCollectionLocationsCount={selectedCollectionLocationsCount}
    availableTours={availableTours}
    locationYear={locationYear}
    onLocationYearChange={onLocationYearChange}
    locationTourStatus={locationTourStatus}
    onLocationTourStatusChange={onLocationTourStatusChange}
    page={page}
    pageSize={pageSize}
    sortMode={sortMode}
    sortDirection={sortDirection}
    pageCount={pageCount}
    totalItems={totalItems}
    selectedTourId={selectedTourId}
    onPageChange={onPageChange}
    onPageSizeChange={onPageSizeChange}
    onSortModeChange={onSortModeChange}
    onSortDirectionChange={onSortDirectionChange}
    onTourFilterChange={onTourFilterChange}
    onToggleSelectAll={onToggleSelectAll}
    onToggleLocation={onToggleLocation}
    onOpenCreateRegion={onOpenCreateRegion}
    onOpenCreateCity={onOpenCreateCity}
    onOpenCreateStreet={onOpenCreateStreet}
    onOpenCreateHouseNumber={onOpenCreateHouseNumber}
    onOpenCreateLocation={onOpenCreateLocation}
    onOpenBulkAssignments={onOpenBulkAssignments}
    onCopyLocation={onCopyLocation}
    onDeleteLocation={onDeleteLocation}
    onDeleteLocations={onDeleteLocations}
    onOpenEditLocation={onOpenEditLocation}
    onOpenEditTour={onOpenEditTour}
    getLocationLabel={getLocationLabel}
  />
);
