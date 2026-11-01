import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { convertRichTextHtmlToPlainText } from '@sva/core';
import { buildWasteStreetKey } from '@sva/waste-management-contracts';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';

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
  houseNumbers?: readonly WasteHouseNumberRecord[];
  cities: readonly WasteCityRecord[];
  streets: readonly WasteStreetRecord[];
}>;

const buildPickupNoteHtml = (
  tourDescription: string | null | undefined,
  pickupNote: string | null | undefined
): string | undefined => {
  const semanticContents = new Set<string>();
  const fragments = [tourDescription, pickupNote].flatMap((value) => {
    if (!value?.trim()) return [];

    const sanitizedHtml = sanitizeRichTextHtml(value).trim();
    const semanticContent = convertRichTextHtmlToPlainText(sanitizedHtml)
      .replace(/\s+/gu, ' ')
      .trim();
    if (!semanticContent || semanticContents.has(semanticContent)) return [];

    semanticContents.add(semanticContent);
    return [sanitizedHtml];
  });

  if (fragments.length === 0) return undefined;
  if (fragments.length === 1) return fragments[0];

  return fragments.map((fragment) => `<div>${fragment}</div>`).join('');
};

export const buildStudioRowsFromMaterialization = (
  input: StudioRowMaterializationInput
): readonly StudioMaterializedWasteRow[] => {
  const tourById = new Map(input.tours.map((tour) => [tour.id, tour] as const));
  const fractionById = new Map(input.fractions.map((fraction) => [fraction.id, fraction] as const));
  const locationById = new Map(input.locations.map((location) => [location.id, location] as const));
  const cityById = new Map(input.cities.map((city) => [city.id, city] as const));
  const streetById = new Map(input.streets.map((street) => [street.id, street] as const));
  const houseNumberById = new Map(
    (input.houseNumbers ?? []).map((houseNumber) => [houseNumber.id, houseNumber] as const)
  );
  const streetLocationsByCity = new Map<string, WasteCollectionLocationRecord[]>();
  for (const location of input.locations) {
    if (!location.active || !location.streetId) continue;
    if (streetById.get(location.streetId)?.cityId !== location.cityId) continue;
    const locations = streetLocationsByCity.get(location.cityId) ?? [];
    locations.push(location);
    streetLocationsByCity.set(location.cityId, locations);
  }

  const rows = input.pickupDates.flatMap((pickupDate) => {
    const tour = tourById.get(pickupDate.tourId);
    const location = locationById.get(pickupDate.locationId);
    if (tour?.status !== 'published' || !location?.active) return [];

    const cityRecord = cityById.get(location.cityId);
    const city = cityRecord?.name?.trim();
    const zip = cityRecord?.postalCode?.trim();
    if (!city) return [];

    const targetLocations = location.streetId
      ? [location]
      : (streetLocationsByCity.get(location.cityId) ?? []).filter(
          (target) =>
            !location.regionId || (target.regionId ?? cityRecord?.regionId) === location.regionId
        );
    const note = buildPickupNoteHtml(tour.description, pickupDate.note);

    return targetLocations.flatMap((target) => {
      const streetName = target.streetId
        ? streetById.get(target.streetId)?.name?.trim()
        : undefined;
      const houseNumberRecord = target.houseNumberId
        ? houseNumberById.get(target.houseNumberId)
        : undefined;
      const houseNumber =
        houseNumberRecord && houseNumberRecord.streetId === target.streetId
          ? houseNumberRecord.number
          : undefined;
      const street = streetName ? buildWasteStreetKey(streetName, houseNumber) : undefined;
      if (!street) return [];

      return tour.wasteFractionIds.flatMap((fractionId) => {
        const fraction = fractionById.get(fractionId);
        if (!fraction) return [];
        if (!fraction.name?.trim()) return [];
        const wasteType = fraction.pdfShortLabel?.trim().toUpperCase();
        if (!wasteType) throw new Error(`missing_waste_type_short_label:${fractionId}`);

        return [
          {
            pickupDate: pickupDate.pickupDate,
            wasteType,
            street,
            ...(zip ? { zip } : {}),
            city,
            ...(note ? { note } : {}),
            key: buildWasteSyncKey({
              pickupDate: pickupDate.pickupDate,
              wasteType,
              street,
              zip,
              city,
              note,
            }),
          },
        ];
      });
    });
  });
  return [...new Map(rows.map((row) => [row.key, row] as const)).values()];
};
