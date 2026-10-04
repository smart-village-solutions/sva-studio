import { useMemo } from 'react';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';

export const useTourAssignmentFilterOptions = (
  locations: readonly TourAssignmentLocationOption[],
  regionFilter: string,
  cityFilter: string
) => {
  const regionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          locations
            .filter((location) => location.regionId && location.regionName)
            .map((location) => [location.regionId, location.regionName] as const)
        )
      ),
    [locations]
  );
  const cityOptions = useMemo(
    () =>
      Array.from(
        new Map(
          locations
            .filter((location) => !regionFilter || location.regionId === regionFilter)
            .map((location) => [location.cityId, location.cityName] as const)
        )
      ),
    [locations, regionFilter]
  );
  const streetOptions = useMemo(
    () =>
      Array.from(
        new Map(
          locations
            .filter(
              (location) =>
                (!regionFilter || location.regionId === regionFilter) &&
                (!cityFilter || location.cityId === cityFilter)
            )
            .map((location) => [location.streetId, location.streetName] as const)
        )
      ),
    [cityFilter, locations, regionFilter]
  );

  return { regionOptions, cityOptions, streetOptions };
};
