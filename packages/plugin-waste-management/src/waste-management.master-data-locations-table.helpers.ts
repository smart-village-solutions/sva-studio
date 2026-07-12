import type {
  WasteMasterDataLocationsTableMaps,
  WasteMasterDataLocationsTableProps,
} from './waste-management.master-data-locations-table.types.js';

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
  const locationTourNamesByLocationId = new Map<string, string[]>();

  for (const link of locationTourLinks) {
    const tourName = toursById.get(link.tourId)?.name;
    if (!tourName) {
      continue;
    }

    const names = locationTourNamesByLocationId.get(link.locationId);
    if (names) {
      names.push(tourName);
      continue;
    }
    locationTourNamesByLocationId.set(link.locationId, [tourName]);
  }

  for (const [locationId, names] of locationTourNamesByLocationId.entries()) {
    names.sort((left, right) => left.localeCompare(right, 'de'));
    locationTourNamesByLocationId.set(locationId, names);
  }

  return {
    regionsById: new Map(regions.map((region) => [region.id, region] as const)),
    citiesById: new Map(cities.map((city) => [city.id, city] as const)),
    streetsById: new Map(streets.map((street) => [street.id, street] as const)),
    houseNumbersById: new Map(
      houseNumbers.map((houseNumber) => [houseNumber.id, houseNumber] as const)
    ),
    toursById,
    locationTourNamesByLocationId,
  };
};
