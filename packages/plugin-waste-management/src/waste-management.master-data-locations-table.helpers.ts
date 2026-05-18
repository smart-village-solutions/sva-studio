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
>): WasteMasterDataLocationsTableMaps => {
  const toursById = new Map(availableTours.map((tour) => [tour.id, tour] as const));
  const locationTourNamesByLocationId = new Map<string, readonly string[]>();

  for (const link of locationTourLinks) {
    const tourName = toursById.get(link.tourId)?.name;
    if (!tourName) {
      continue;
    }

    const names = locationTourNamesByLocationId.get(link.locationId) ?? [];
    locationTourNamesByLocationId.set(link.locationId, [...names, tourName]);
  }

  for (const [locationId, names] of locationTourNamesByLocationId.entries()) {
    locationTourNamesByLocationId.set(locationId, [...names].sort((left, right) => left.localeCompare(right, 'de')));
  }

  return {
    regionsById: new Map(regions.map((region) => [region.id, region] as const)),
    citiesById: new Map(cities.map((city) => [city.id, city] as const)),
    streetsById: new Map(streets.map((street) => [street.id, street] as const)),
    houseNumbersById: new Map(houseNumbers.map((houseNumber) => [houseNumber.id, houseNumber] as const)),
    toursById,
    locationTourNamesByLocationId,
  };
};
