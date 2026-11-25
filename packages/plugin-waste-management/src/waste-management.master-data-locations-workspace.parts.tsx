import { WasteMasterDataLocationsTable } from './waste-management.master-data-locations-table.js';
import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';

export const WasteMasterDataLocationsTableSection = ({
  regions,
  search,
  onQueryChange,
  onResetFilters,
  onApplyFilters,
  tools,
  toolContent,
  cities,
  streets,
  houseNumbers,
  collectionLocations,
  locationTourLinks,
  selectedLocationIds,
  allFilteredLocationsSelected,
  selectedCollectionLocationsCount,
  hiddenSelectedLocationsCount,
  matchingSelectedLocationsCount,
  availableTours,
  locationYear,
  locationTourStatus,
  page,
  pageSize,
  sortMode,
  sortDirection,
  pageCount,
  totalItems,
  onPageChange,
  onPageSizeChange,
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
  | 'onApplyFilters'
  | 'tools'
  | 'toolContent'
  | 'cities'
  | 'streets'
  | 'houseNumbers'
  | 'collectionLocations'
  | 'locationTourLinks'
  | 'selectedLocationIds'
  | 'allFilteredLocationsSelected'
  | 'selectedCollectionLocationsCount'
  | 'hiddenSelectedLocationsCount'
  | 'matchingSelectedLocationsCount'
  | 'availableTours'
  | 'locationYear'
  | 'locationTourStatus'
  | 'onPageChange'
  | 'onPageSizeChange'
  | 'sortMode'
  | 'sortDirection'
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
    onApplyFilters={onApplyFilters}
    tools={tools}
    toolContent={toolContent}
    regions={regions}
    cities={cities}
    streets={streets}
    houseNumbers={houseNumbers}
    collectionLocations={collectionLocations}
    locationTourLinks={locationTourLinks}
    selectedLocationIds={selectedLocationIds}
    allFilteredLocationsSelected={allFilteredLocationsSelected}
    selectedCollectionLocationsCount={selectedCollectionLocationsCount}
    hiddenSelectedLocationsCount={hiddenSelectedLocationsCount}
    matchingSelectedLocationsCount={matchingSelectedLocationsCount}
    availableTours={availableTours}
    locationYear={locationYear}
    locationTourStatus={locationTourStatus}
    page={page}
    pageSize={pageSize}
    sortMode={sortMode}
    sortDirection={sortDirection}
    pageCount={pageCount}
    totalItems={totalItems}
    onPageChange={onPageChange}
    onPageSizeChange={onPageSizeChange}
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
