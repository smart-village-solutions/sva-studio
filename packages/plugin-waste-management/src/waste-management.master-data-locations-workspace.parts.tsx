import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';

import { WasteMasterDataLocationsHierarchy } from './waste-management.master-data-locations-hierarchy.js';
import { WasteMasterDataLocationsOverview } from './waste-management.master-data-locations-overview.js';
import { WasteMasterDataLocationsTable } from './waste-management.master-data-locations-table.js';
import type { WasteMasterDataLocationsWorkspaceProps } from './waste-management.master-data-locations-workspace.types.js';

export const WasteMasterDataLocationsOverviewSection = ({
  regions,
  cities,
  streets,
  houseNumbers,
  collectionLocations,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
}: {
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly collectionLocations: readonly WasteCollectionLocationRecord[];
  readonly onOpenCreateRegion: () => void;
  readonly onOpenCreateCity: () => void;
  readonly onOpenCreateStreet: () => void;
  readonly onOpenCreateHouseNumber: () => void;
  readonly onOpenCreateLocation: () => void;
}) => (
  <WasteMasterDataLocationsOverview
    collectionLocationCount={collectionLocations.length}
    regionCount={regions.length}
    cityCount={cities.length}
    streetCount={streets.length}
    houseNumberCount={houseNumbers.length}
    onOpenCreateRegion={onOpenCreateRegion}
    onOpenCreateCity={onOpenCreateCity}
    onOpenCreateStreet={onOpenCreateStreet}
    onOpenCreateHouseNumber={onOpenCreateHouseNumber}
    onOpenCreateLocation={onOpenCreateLocation}
  />
);

export const WasteMasterDataLocationsHierarchySection = ({
  regions,
  cities,
  streets,
  houseNumbers,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenEditRegion,
  onOpenEditCity,
  onOpenEditStreet,
  onOpenEditHouseNumber,
}: {
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly onOpenCreateRegion: () => void;
  readonly onOpenCreateCity: () => void;
  readonly onOpenCreateStreet: () => void;
  readonly onOpenCreateHouseNumber: () => void;
  readonly onOpenEditRegion: (region: WasteRegionRecord) => void;
  readonly onOpenEditCity: (city: WasteCityRecord) => void;
  readonly onOpenEditStreet: (street: WasteStreetRecord) => void;
  readonly onOpenEditHouseNumber: (houseNumber: WasteHouseNumberRecord) => void;
}) => (
  <WasteMasterDataLocationsHierarchy
    regions={regions}
    cities={cities}
    streets={streets}
    houseNumbers={houseNumbers}
    onOpenCreateRegion={onOpenCreateRegion}
    onOpenCreateCity={onOpenCreateCity}
    onOpenCreateStreet={onOpenCreateStreet}
    onOpenCreateHouseNumber={onOpenCreateHouseNumber}
    onOpenEditRegion={onOpenEditRegion}
    onOpenEditCity={onOpenEditCity}
    onOpenEditStreet={onOpenEditStreet}
    onOpenEditHouseNumber={onOpenEditHouseNumber}
  />
);

export const WasteMasterDataLocationsTableSection = ({
  regions,
  cities,
  streets,
  houseNumbers,
  collectionLocations,
  locationTourLinks,
  outputOverview,
  selectedLocationIds,
  allFilteredLocationsSelected,
  selectedCollectionLocationsCount,
  availableTours,
  page,
  pageSize,
  pageCount,
  totalItems,
  selectedTourId,
  onPageChange,
  onPageSizeChange,
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
  getLocationLabel,
}: Pick<
  WasteMasterDataLocationsWorkspaceProps,
  | 'regions'
  | 'cities'
  | 'streets'
  | 'houseNumbers'
  | 'collectionLocations'
  | 'locationTourLinks'
  | 'outputOverview'
  | 'selectedLocationIds'
  | 'allFilteredLocationsSelected'
  | 'selectedCollectionLocationsCount'
  | 'availableTours'
  | 'selectedTourId'
  | 'onPageChange'
  | 'onPageSizeChange'
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
  | 'getLocationLabel'
> & {
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly totalItems: number;
}) => (
  <WasteMasterDataLocationsTable
    regions={regions}
    cities={cities}
    streets={streets}
    houseNumbers={houseNumbers}
    collectionLocations={collectionLocations}
    locationTourLinks={locationTourLinks}
    outputOverview={outputOverview}
    selectedLocationIds={selectedLocationIds}
    allFilteredLocationsSelected={allFilteredLocationsSelected}
    selectedCollectionLocationsCount={selectedCollectionLocationsCount}
    availableTours={availableTours}
    page={page}
    pageSize={pageSize}
    pageCount={pageCount}
    totalItems={totalItems}
    selectedTourId={selectedTourId}
    onPageChange={onPageChange}
    onPageSizeChange={onPageSizeChange}
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
    getLocationLabel={getLocationLabel}
  />
);
