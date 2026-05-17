import type {
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';

import type { WasteMasterDataLocationsTableMaps, WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';

export const formatAddressLine = ({
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
  locationTourNamesByLocationId: locationTourLinks.reduce<Map<string, readonly string[]>>((namesByLocationId, link) => {
    const tourName = availableTours.find((tour) => tour.id === link.tourId)?.name;
    if (!tourName) {
      return namesByLocationId;
    }
    const names = namesByLocationId.get(link.locationId) ?? [];
    namesByLocationId.set(link.locationId, [...names, tourName].sort((left, right) => left.localeCompare(right)));
    return namesByLocationId;
  }, new Map()),
});
