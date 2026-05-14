import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Select, StudioEmptyState } from '@sva/studio-ui-react';

export type WasteMasterDataLocationsTableProps = {
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
  readonly onOpenBulkAssignments: () => void;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  readonly getLocationLabel: (location: WasteCollectionLocationRecord) => string;
};

export type WasteMasterDataLocationsTableMaps = {
  readonly regionsById: ReadonlyMap<string, WasteRegionRecord>;
  readonly citiesById: ReadonlyMap<string, WasteCityRecord>;
  readonly streetsById: ReadonlyMap<string, WasteStreetRecord>;
  readonly houseNumbersById: ReadonlyMap<string, WasteHouseNumberRecord>;
  readonly toursById: ReadonlyMap<string, WasteTourRecord>;
  readonly locationTourCountByLocationId: ReadonlyMap<string, number>;
};
const formatAddressLine = ({
  streetsById,
  houseNumbersById,
  location,
  fallback,
}: {
  readonly streetsById: ReadonlyMap<string, WasteStreetRecord>;
  readonly houseNumbersById: ReadonlyMap<string, WasteHouseNumberRecord>;
  readonly location: WasteCollectionLocationRecord;
  readonly fallback: string;
}) => {
  const street = location.streetId ? streetsById.get(location.streetId) : undefined;
  const houseNumber = location.houseNumberId ? houseNumbersById.get(location.houseNumberId) : undefined;
  const parts = [street?.name, houseNumber?.number].filter(Boolean);

  return parts.length ? parts.join(' ') : fallback;
};

export const createLocationsTableMaps = ({
  regions,
  cities,
  streets,
  houseNumbers,
  availableTours,
  locationTourLinks,
}: Pick<
  WasteMasterDataLocationsTableProps,
  'regions' | 'cities' | 'streets' | 'houseNumbers' | 'availableTours' | 'locationTourLinks'
>): WasteMasterDataLocationsTableMaps => ({
  regionsById: new Map(regions.map((region) => [region.id, region] as const)),
  citiesById: new Map(cities.map((city) => [city.id, city] as const)),
  streetsById: new Map(streets.map((street) => [street.id, street] as const)),
  houseNumbersById: new Map(houseNumbers.map((houseNumber) => [houseNumber.id, houseNumber] as const)),
  toursById: new Map(availableTours.map((tour) => [tour.id, tour] as const)),
  locationTourCountByLocationId: locationTourLinks.reduce<Map<string, number>>((counts, link) => {
    counts.set(link.locationId, (counts.get(link.locationId) ?? 0) + 1);
    return counts;
  }, new Map()),
});

export const WasteMasterDataLocationsTableToolbar = ({
  selectedCollectionLocationsCount,
  availableTours,
  allFilteredLocationsSelected,
  selectedTourId,
  onOpenBulkAssignments,
  onToggleSelectAll,
  onTourFilterChange,
}: Pick<
  WasteMasterDataLocationsTableProps,
  | 'selectedCollectionLocationsCount'
  | 'availableTours'
  | 'allFilteredLocationsSelected'
  | 'selectedTourId'
  | 'onOpenBulkAssignments'
  | 'onToggleSelectAll'
  | 'onTourFilterChange'
>) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={selectedCollectionLocationsCount === 0 || availableTours.length === 0}
          onClick={onOpenBulkAssignments}
        >
          {pt('masterData.collectionLocations.bulk.actions.openAssign', { value: selectedCollectionLocationsCount })}
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={allFilteredLocationsSelected} onChange={(event) => onToggleSelectAll(event.currentTarget.checked)} />
          <span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{pt('masterData.locationsWorkspace.filters.tour')}</span>
        <Select
          aria-label={pt('masterData.locationsWorkspace.filters.tour')}
          value={selectedTourId ?? ''}
          onChange={(event) => onTourFilterChange(event.target.value)}
        >
          <option value="">{pt('masterData.locationsWorkspace.filters.allTours')}</option>
          {availableTours.map((tour) => (
            <option key={tour.id} value={tour.id}>
              {tour.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
};

export const WasteMasterDataActiveTourBanner = ({
  selectedTour,
  onTourFilterChange,
}: {
  readonly selectedTour?: WasteTourRecord;
  readonly onTourFilterChange: (tourId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  if (!selectedTour) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">{pt('masterData.locationsWorkspace.filters.activeTour')}</span>
      <span className="text-sm font-medium">{selectedTour.name}</span>
      <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => onTourFilterChange('')}>
        {pt('masterData.locationsWorkspace.filters.clearTour')}
      </Button>
    </div>
  );
};

export const WasteMasterDataLocationsHeader = () => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
      <tr>
        <th scope="col" className="w-12 px-3 py-3">
          <span className="sr-only">{pt('masterData.locationsWorkspace.table.selection')}</span>
        </th>
        <th scope="col" className="px-3 py-3">{pt('masterData.locationsWorkspace.table.region')}</th>
        <th scope="col" className="px-3 py-3">{pt('masterData.locationsWorkspace.table.city')}</th>
        <th scope="col" className="px-3 py-3">{pt('masterData.locationsWorkspace.table.address')}</th>
        <th scope="col" className="px-3 py-3">{pt('masterData.locationsWorkspace.table.tours')}</th>
        <th scope="col" className="px-3 py-3">{pt('masterData.locationsWorkspace.table.status')}</th>
        <th scope="col" className="px-3 py-3">{pt('masterData.locationsWorkspace.table.locationId')}</th>
        <th scope="col" className="px-3 py-3 text-right">{pt('masterData.locationsWorkspace.table.actions')}</th>
      </tr>
    </thead>
  );
};

export const WasteMasterDataLocationsRow = ({
  location,
  maps,
  selectedLocationIds,
  onToggleLocation,
  onOpenEditLocation,
  getLocationLabel,
}: {
  readonly location: WasteCollectionLocationRecord;
  readonly maps: WasteMasterDataLocationsTableMaps;
  readonly selectedLocationIds: readonly string[];
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
  readonly onOpenEditLocation: (location: WasteCollectionLocationRecord) => void;
  readonly getLocationLabel: (location: WasteCollectionLocationRecord) => string;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const region = location.regionId ? maps.regionsById.get(location.regionId) : undefined;
  const city = maps.citiesById.get(location.cityId);
  const linkedTourCount = maps.locationTourCountByLocationId.get(location.id) ?? 0;

  return (
    <tr className="border-t border-border text-sm text-foreground">
      <td className="px-3 py-3 align-top">
        <Checkbox
          aria-label={pt('masterData.locationsWorkspace.table.selectRow', { rowId: location.id })}
          checked={selectedLocationIds.includes(location.id)}
          onChange={(event) => onToggleLocation(location.id, event.currentTarget.checked)}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-medium">{region?.name ?? pt('masterData.locationsWorkspace.table.regionUnavailable')}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-medium">{city?.name ?? pt('masterData.locationsWorkspace.table.cityUnavailable')}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <p className="font-medium">
            {formatAddressLine({
              streetsById: maps.streetsById,
              houseNumbersById: maps.houseNumbersById,
              location,
              fallback: pt('masterData.locationsWorkspace.table.addressUnavailable'),
            })}
          </p>
          <p className="text-xs text-muted-foreground">{getLocationLabel(location)}</p>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="text-sm">{pt('masterData.locationsWorkspace.table.tourCount', { value: linkedTourCount })}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <span className="text-sm">{location.active ? pt('common.active') : pt('common.inactive')}</span>
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">{location.id}</td>
      <td className="px-3 py-3 align-top text-right">
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenEditLocation(location)}>
          {pt('masterData.collectionLocations.actions.edit')}
        </Button>
      </td>
    </tr>
  );
};

export const WasteMasterDataLocationsEmptyState = () => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="p-6">
      <StudioEmptyState>
        <div className="space-y-2 text-left">
          <p className="font-medium">{pt('masterData.locationsWorkspace.emptyTitle')}</p>
          <p>{pt('masterData.locationsWorkspace.emptyBody')}</p>
        </div>
      </StudioEmptyState>
    </div>
  );
};
