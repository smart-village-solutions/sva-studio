import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { convertRichTextHtmlToPlainText } from '@sva/core';
import {
  buildWasteStreetKey,
  wasteLocationTourPickupDateImportDefaults,
} from '@sva/waste-management-contracts';
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

const buildPickupNote = (
  descriptions: readonly (string | null | undefined)[],
  notes: readonly (string | null | undefined)[]
): string | undefined => {
  const semanticContents = new Set<string>();
  const semanticStopContents = new Set<string>();
  const fragments = [...descriptions, ...notes].flatMap((value, index) => {
    if (!value?.trim()) return [];

    const sanitizedHtml = sanitizeRichTextHtml(value).trim();
    const semanticContent = convertRichTextHtmlToPlainText(sanitizedHtml)
      .replace(/\s+/gu, ' ')
      .trim();
    if (!semanticContent) return [];
    if (index >= descriptions.length) semanticStopContents.add(semanticContent);
    if (semanticContents.has(semanticContent)) return [];

    semanticContents.add(semanticContent);
    return [sanitizedHtml];
  });

  if (fragments.length === 0) return undefined;
  // Existing app clients render the combined stop note as plain React Native text.
  if (semanticStopContents.size > 1) return [...semanticContents].join('\n');
  if (fragments.length === 1) return fragments[0];

  return fragments.map((fragment) => `<div>${fragment}</div>`).join('');
};

type PickupText = string | Set<string> | undefined;
type PickupGroup = {
  row: StudioMaterializedWasteRow;
  descriptions?: PickupText;
  notes?: PickupText;
};

const addPickupText = (current: PickupText, value?: string | null): PickupText => {
  if (!value || current === value) return current;
  if (current instanceof Set) {
    current.add(value);
    return current;
  }
  return current === undefined ? value : new Set([current, value]);
};

const sortedPickupText = (value: PickupText): readonly string[] => {
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [...value].sort();
};

const resolvePickupGroupNote = (
  { descriptions, notes }: PickupGroup,
  singleNoteCache: Map<string, string | undefined>
): string | undefined => {
  if (descriptions === undefined && notes === undefined) return undefined;
  const singleText = descriptions ?? notes;
  if (typeof singleText !== 'string' || (descriptions !== undefined && notes !== undefined)) {
    return buildPickupNote(sortedPickupText(descriptions), sortedPickupText(notes));
  }
  if (singleNoteCache.has(singleText)) return singleNoteCache.get(singleText);
  const note = buildPickupNote([singleText], []);
  if (singleNoteCache.size < 1024) singleNoteCache.set(singleText, note);
  return note;
};

const resolveAddressStreet = (
  location: WasteCollectionLocationRecord,
  streetById: ReadonlyMap<string, WasteStreetRecord>,
  houseNumberById: ReadonlyMap<string, WasteHouseNumberRecord>
): string | undefined => {
  if (!location.streetId) return undefined;
  const name = streetById.get(location.streetId)?.name?.trim();
  if (!name) return undefined;
  const house = location.houseNumberId ? houseNumberById.get(location.houseNumberId) : undefined;
  const number = house?.streetId === location.streetId ? house.number : undefined;
  return buildWasteStreetKey(name, number);
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

  // The Mainserver bulk API identifies pickups by date and location type, without the note.
  const groupedRows = new Map<string, PickupGroup>();
  for (const pickupDate of input.pickupDates) {
    const tour = tourById.get(pickupDate.tourId);
    const location = locationById.get(pickupDate.locationId);
    if (tour?.status !== 'published' || !location?.active) continue;

    const cityRecord = cityById.get(location.cityId);
    const city = cityRecord?.name?.trim();
    const zip = cityRecord?.postalCode?.trim();
    if (!city) continue;

    const isCityWide =
      !location.streetId ||
      streetById
        .get(location.streetId)
        ?.name.trim()
        .localeCompare(wasteLocationTourPickupDateImportDefaults.allStreetsName, 'de', {
          sensitivity: 'base',
        }) === 0;
    const targetLocations = isCityWide
      ? (streetLocationsByCity.get(location.cityId) ?? []).filter(
          (target) =>
            !location.regionId || (target.regionId ?? cityRecord?.regionId) === location.regionId
        )
      : [location];

    for (const target of targetLocations) {
      const street = resolveAddressStreet(target, streetById, houseNumberById);
      if (!street) continue;

      for (const fractionId of tour.wasteFractionIds) {
        const fraction = fractionById.get(fractionId);
        if (!fraction?.name?.trim()) continue;
        const wasteType = fraction.pdfShortLabel?.trim().toUpperCase();
        if (!wasteType) throw new Error(`missing_waste_type_short_label:${fractionId}`);

        const row = {
          pickupDate: pickupDate.pickupDate,
          wasteType,
          street,
          ...(zip ? { zip } : {}),
          city,
        };
        const key = buildWasteSyncKey(row);
        const group = groupedRows.get(key) ?? { row: { ...row, key } };
        group.descriptions = addPickupText(group.descriptions, tour.description);
        group.notes = addPickupText(group.notes, pickupDate.note);
        groupedRows.set(key, group);
      }
    }
  }

  const singleNoteCache = new Map<string, string | undefined>();
  const result: StudioMaterializedWasteRow[] = [];
  for (const [key, group] of groupedRows) {
    const note = resolvePickupGroupNote(group, singleNoteCache);
    const { row } = group;
    result.push({
      ...row,
      note,
      key: note === undefined ? row.key : buildWasteSyncKey({ ...row, note }),
    });
    groupedRows.delete(key);
  }
  return result;
};
