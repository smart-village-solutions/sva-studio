import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';

import type { MaterializedLocationTourPickupDateRecord } from './waste-management-mainserver-sync.materialization.js';
import { buildWasteSyncKey } from './waste-management-mainserver-sync.rows.js';

export type StudioMaterializedWasteRow = Readonly<{
  pickupDate: string;
  wasteType: string;
  street: string;
  zip?: string;
  city: string;
  note?: string;
  key: string;
}>;

type StudioRowMaterializationInput = Readonly<{
  pickupDates: readonly MaterializedLocationTourPickupDateRecord[];
  tours: readonly WasteTourRecord[];
  fractions: readonly WasteFractionRecord[];
  locations: readonly WasteCollectionLocationRecord[];
  cities: readonly WasteCityRecord[];
  streets: readonly WasteStreetRecord[];
}>;

export const buildStudioRowsFromMaterialization = (
  input: StudioRowMaterializationInput
): readonly StudioMaterializedWasteRow[] => {
  const tourById = new Map(input.tours.map((tour) => [tour.id, tour] as const));
  const fractionById = new Map(input.fractions.map((fraction) => [fraction.id, fraction] as const));
  const locationById = new Map(input.locations.map((location) => [location.id, location] as const));
  const cityById = new Map(input.cities.map((city) => [city.id, city] as const));
  const streetById = new Map(input.streets.map((street) => [street.id, street] as const));

  return input.pickupDates.flatMap((pickupDate) => {
    const tour = tourById.get(pickupDate.tourId);
    const location = locationById.get(pickupDate.locationId);
    if (!tour || !location?.active) return [];

    const city = cityById.get(location.cityId)?.name?.trim();
    const street = location.streetId ? streetById.get(location.streetId)?.name?.trim() : undefined;
    if (!city || !street) return [];

    return tour.wasteFractionIds.flatMap((fractionId) => {
      const wasteType = fractionById.get(fractionId)?.name?.trim();
      if (!wasteType) return [];

      return [{
        pickupDate: pickupDate.pickupDate,
        wasteType,
        street,
        city,
        note: pickupDate.note ?? undefined,
        key: buildWasteSyncKey({
          pickupDate: pickupDate.pickupDate,
          wasteType,
          street,
          city,
          note: pickupDate.note ?? undefined,
        }),
      }];
    });
  });
};
