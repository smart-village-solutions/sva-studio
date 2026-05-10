import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';
import { WasteMasterDataLocationsHierarchy } from './waste-management.master-data-locations-hierarchy.js';
import { WasteMasterDataLocationsOverview } from './waste-management.master-data-locations-overview.js';
import { WasteMasterDataLocationsTable } from './waste-management.master-data-locations-table.js';

type WasteMasterDataLocationsWorkspaceProps = {
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly collectionLocations: readonly WasteCollectionLocationRecord[];
  readonly locationTourLinks: readonly WasteLocationTourLinkRecord[];
  readonly selectedLocationIds: readonly string[];
  readonly allFilteredLocationsSelected: boolean;
  readonly selectedCollectionLocationsCount: number;
  readonly availableTours: readonly WasteTourRecord[];
  readonly selectedTourId?: string;
  readonly onTourFilterChange: (tourId: string) => void;
  readonly onToggleSelectAll: (checked: boolean) => void;
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onOpenCreateRegion: () => void;
  readonly onOpenCreateCity: () => void;
  readonly onOpenCreateStreet: () => void;
  readonly onOpenCreateHouseNumber: () => void;
  readonly onOpenCreateLocation: () => void;
  readonly onOpenEditRegion: (region: WasteRegionRecord) => void;
  readonly onOpenEditCity: (city: WasteCityRecord) => void;
  readonly onOpenEditStreet: (street: WasteStreetRecord) => void;
  readonly onOpenEditHouseNumber: (houseNumber: WasteHouseNumberRecord) => void;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  readonly onOpenBulkAssignments: () => void;
  readonly getLocationLabel: (location: WasteCollectionLocationRecord) => string;
};

export const WasteMasterDataLocationsWorkspace = ({
  regions,
  cities,
  streets,
  houseNumbers,
  collectionLocations,
  locationTourLinks,
  selectedLocationIds,
  allFilteredLocationsSelected,
  selectedCollectionLocationsCount,
  availableTours,
  selectedTourId,
  onTourFilterChange,
  onToggleSelectAll,
  onToggleLocation,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
  onOpenEditRegion,
  onOpenEditCity,
  onOpenEditStreet,
  onOpenEditHouseNumber,
  onOpenEditLocation,
  onOpenBulkAssignments,
  getLocationLabel,
}: WasteMasterDataLocationsWorkspaceProps) => {
  return (
    <div className="space-y-4">
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
      <WasteMasterDataLocationsTable
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
        selectedTourId={selectedTourId}
        onTourFilterChange={onTourFilterChange}
        onToggleSelectAll={onToggleSelectAll}
        onToggleLocation={onToggleLocation}
        onOpenBulkAssignments={onOpenBulkAssignments}
        onOpenEditLocation={onOpenEditLocation}
        getLocationLabel={getLocationLabel}
      />
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
    </div>
  );
};
