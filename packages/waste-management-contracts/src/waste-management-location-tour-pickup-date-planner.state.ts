import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from './waste-management-master-data.js';
import { type WasteLocationTourPickupDateImportPlanningSnapshot } from './waste-management-location-tour-pickup-date-import.types.js';

type MutableEntitySummary = {
  existing: number;
  created: number;
};

export type PlannerState = {
  readonly createId: () => string;
  readonly summary: {
    fractions: MutableEntitySummary;
    regions: MutableEntitySummary;
    cities: MutableEntitySummary;
    streets: MutableEntitySummary;
    houseNumbers: MutableEntitySummary;
    locations: MutableEntitySummary;
    assignments: MutableEntitySummary;
  };
  readonly touchedExisting: Record<string, Set<string>>;
  readonly existingFractions: Set<string>;
  readonly newFractions: Set<string>;
  readonly existingTours: Set<string>;
  readonly newTours: Set<string>;
  readonly assignmentKeys: Set<string>;
  readonly fractionByKey: Map<string, WasteFractionRecord>;
  readonly regionByKey: Map<string, WasteRegionRecord>;
  readonly cityByKey: Map<string, WasteCityRecord>;
  readonly citiesByName: Map<string, WasteCityRecord[]>;
  readonly streetByKey: Map<string, WasteStreetRecord>;
  readonly houseNumberByKey: Map<string, WasteHouseNumberRecord>;
  readonly locationByKey: Map<string, WasteCollectionLocationRecord>;
  readonly tourByName: Map<string, WasteTourRecord>;
  readonly upserts: {
    fractions: Map<string, WasteFractionRecord>;
    regions: Map<string, WasteRegionRecord>;
    cities: Map<string, WasteCityRecord>;
    streets: Map<string, WasteStreetRecord>;
    houseNumbers: Map<string, WasteHouseNumberRecord>;
    locations: Map<string, WasteCollectionLocationRecord>;
    tours: Map<string, WasteTourRecord>;
    assignments: Map<string, WasteLocationTourLinkRecord>;
  };
};

export const normalizeKeyPart = (value: string | undefined): string =>
  (value ?? '').trim().toLocaleLowerCase('de-DE');
const createEntitySummary = (): MutableEntitySummary => ({ existing: 0, created: 0 });
export const createRuntimeUuid = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const randomValues = new Uint32Array(2);
    globalThis.crypto.getRandomValues(randomValues);
    return `wm-${randomValues[0]!.toString(36)}-${randomValues[1]!.toString(36)}`;
  }

  return `wm-${Date.now().toString(36)}-${performance.now().toString(36).replace('.', '')}`;
};

const createPlanningSummary = () => ({
  fractions: createEntitySummary(),
  regions: createEntitySummary(),
  cities: createEntitySummary(),
  streets: createEntitySummary(),
  houseNumbers: createEntitySummary(),
  locations: createEntitySummary(),
  assignments: createEntitySummary(),
});

export const markExistingUsage = (
  bucket: MutableEntitySummary,
  key: string,
  touchedExisting: Set<string>
) => {
  if (!touchedExisting.has(key)) {
    touchedExisting.add(key);
    bucket.existing += 1;
  }
};

export const createState = (
  snapshot: WasteLocationTourPickupDateImportPlanningSnapshot,
  createId: () => string
): PlannerState => ({
  createId,
  summary: createPlanningSummary(),
  touchedExisting: {
    fractions: new Set<string>(),
    regions: new Set<string>(),
    cities: new Set<string>(),
    streets: new Set<string>(),
    houseNumbers: new Set<string>(),
    locations: new Set<string>(),
    assignments: new Set<string>(),
    tours: new Set<string>(),
  },
  existingFractions: new Set<string>(),
  newFractions: new Set<string>(),
  existingTours: new Set<string>(),
  newTours: new Set<string>(),
  assignmentKeys: new Set(
    snapshot.assignments.map((assignment) => `${assignment.locationId}::${assignment.tourId}`)
  ),
  fractionByKey: new Map(
    snapshot.fractions.map((fraction) => [normalizeKeyPart(fraction.name), fraction])
  ),
  regionByKey: new Map(snapshot.regions.map((region) => [normalizeKeyPart(region.name), region])),
  cityByKey: new Map(
    snapshot.cities.map((city) => [`${city.regionId ?? ''}::${normalizeKeyPart(city.name)}`, city])
  ),
  citiesByName: snapshot.cities.reduce<Map<string, WasteCityRecord[]>>((citiesByName, city) => {
    const cityKey = normalizeKeyPart(city.name);
    const existing = citiesByName.get(cityKey) ?? [];
    citiesByName.set(cityKey, [...existing, city]);
    return citiesByName;
  }, new Map()),
  streetByKey: new Map(
    snapshot.streets.map((street) => [`${street.cityId}::${normalizeKeyPart(street.name)}`, street])
  ),
  houseNumberByKey: new Map(
    snapshot.houseNumbers.map((houseNumber) => [
      `${houseNumber.streetId}::${normalizeKeyPart(houseNumber.number)}`,
      houseNumber,
    ])
  ),
  locationByKey: new Map(
    snapshot.locations.map((location) => [
      `${location.regionId ?? ''}::${location.cityId}::${location.streetId ?? ''}::${location.houseNumberId ?? ''}`,
      location,
    ])
  ),
  tourByName: new Map(snapshot.tours.map((tour) => [normalizeKeyPart(tour.name), tour])),
  upserts: {
    fractions: new Map<string, WasteFractionRecord>(),
    regions: new Map<string, WasteRegionRecord>(),
    cities: new Map<string, WasteCityRecord>(),
    streets: new Map<string, WasteStreetRecord>(),
    houseNumbers: new Map<string, WasteHouseNumberRecord>(),
    locations: new Map<string, WasteCollectionLocationRecord>(),
    tours: new Map<string, WasteTourRecord>(),
    assignments: new Map<string, WasteLocationTourLinkRecord>(),
  },
});

export const registerCreatedRecord = <T extends { readonly id: string }>(
  bucket: Map<string, T>,
  record: T
): T => {
  bucket.set(record.id, record);
  return record;
};
export const shouldCountAsExisting = <T extends { readonly id: string }>(
  bucket: Map<string, T>,
  id: string
): boolean => {
  return !bucket.has(id);
};
