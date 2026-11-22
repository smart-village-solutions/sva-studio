import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';

const sortOptions = (options: readonly (readonly [string, string])[]) =>
  Array.from(new Map(options.filter(([id, name]) => id && name))).sort(
    ([leftId, leftName], [rightId, rightName]) =>
      leftName.localeCompare(rightName, 'de', { numeric: true, sensitivity: 'base' }) ||
      leftId.localeCompare(rightId)
  );

export const matchesTourAssignmentScope = (
  location: TourAssignmentLocationOption,
  region: string,
  city: string,
  street = ''
) =>
  (!region || location.regionId === region) &&
  (!city || location.cityId === city) &&
  (!street || location.streetId === street);

export const getTourAssignmentFilterOptions = (
  locations: readonly TourAssignmentLocationOption[],
  regionFilter: string,
  cityFilter: string
) => ({
  regionOptions: sortOptions(locations.map(({ regionId, regionName }) => [regionId, regionName])),
  cityOptions: sortOptions(
    locations
      .filter((location) => matchesTourAssignmentScope(location, regionFilter, ''))
      .map(({ cityId, cityName }) => [cityId, cityName])
  ),
  streetOptions: sortOptions(
    locations
      .filter((location) => matchesTourAssignmentScope(location, regionFilter, cityFilter))
      .map(({ streetId, streetName }) => [streetId, streetName])
  ),
});
