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
import {
  type WasteLocationTourPickupDateImportPlan,
  type WasteLocationTourPickupDateImportPlanningSnapshot,
  type WasteLocationTourPickupDateImportRow,
  type WasteLocationTourPickupDateImportSummary,
  wasteLocationTourPickupDateImportDefaults,
} from './waste-management-location-tour-pickup-date-import.types.js';

type MutableEntitySummary = {
  existing: number;
  created: number;
};

type PlannerState = {
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

const normalizeKeyPart = (value: string | undefined): string => (value ?? '').trim().toLocaleLowerCase('de-DE');
const createEntitySummary = (): MutableEntitySummary => ({ existing: 0, created: 0 });
const createRuntimeUuid = (): string => {
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

const markExistingUsage = (bucket: MutableEntitySummary, key: string, touchedExisting: Set<string>) => {
  if (!touchedExisting.has(key)) {
    touchedExisting.add(key);
    bucket.existing += 1;
  }
};

const createState = (snapshot: WasteLocationTourPickupDateImportPlanningSnapshot, createId: () => string): PlannerState => ({
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
  assignmentKeys: new Set(snapshot.assignments.map((assignment) => `${assignment.locationId}::${assignment.tourId}`)),
  fractionByKey: new Map(snapshot.fractions.map((fraction) => [normalizeKeyPart(fraction.name), fraction])),
  regionByKey: new Map(snapshot.regions.map((region) => [normalizeKeyPart(region.name), region])),
  cityByKey: new Map(snapshot.cities.map((city) => [`${city.regionId ?? ''}::${normalizeKeyPart(city.name)}`, city])),
  citiesByName: snapshot.cities.reduce<Map<string, WasteCityRecord[]>>((citiesByName, city) => {
    const cityKey = normalizeKeyPart(city.name);
    const existing = citiesByName.get(cityKey) ?? [];
    citiesByName.set(cityKey, [...existing, city]);
    return citiesByName;
  }, new Map()),
  streetByKey: new Map(snapshot.streets.map((street) => [`${street.cityId}::${normalizeKeyPart(street.name)}`, street])),
  houseNumberByKey: new Map(
    snapshot.houseNumbers.map((houseNumber) => [`${houseNumber.streetId}::${normalizeKeyPart(houseNumber.number)}`, houseNumber])
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

const registerCreatedRecord = <T extends { readonly id: string }>(bucket: Map<string, T>, record: T): T => {
  bucket.set(record.id, record);
  return record;
};

const registerCityByName = (bucket: Map<string, WasteCityRecord[]>, city: WasteCityRecord) => {
  const cityKey = normalizeKeyPart(city.name);
  const cities = bucket.get(cityKey) ?? [];
  bucket.set(cityKey, [...cities, city]);
};

const createAmbiguousRegionlessCityMatchError = (cityName: string): Error =>
  new Error(`ambiguous_regionless_city_match:${cityName}`);

const shouldCountAsExisting = <T extends { readonly id: string }>(bucket: Map<string, T>, id: string): boolean => {
  return !bucket.has(id);
};

const ensureRegion = (state: PlannerState, regionName: string | undefined): string | undefined => {
  if (!regionName) {
    return undefined;
  }

  const regionKey = normalizeKeyPart(regionName);
  const existingRegion = state.regionByKey.get(regionKey);
  if (existingRegion) {
    if (shouldCountAsExisting(state.upserts.regions, existingRegion.id)) {
      markExistingUsage(state.summary.regions, existingRegion.id, state.touchedExisting.regions);
    }
    return existingRegion.id;
  }

  const region = registerCreatedRecord(state.upserts.regions, {
    id: state.createId(),
    name: regionName,
    createdAt: '',
    updatedAt: '',
  });
  state.regionByKey.set(regionKey, region);
  state.summary.regions.created += 1;
  return region.id;
};

const ensureCity = (state: PlannerState, regionId: string | undefined, cityName: string): WasteCityRecord => {
  const cityKey = `${regionId ?? ''}::${normalizeKeyPart(cityName)}`;
  const existingCity = state.cityByKey.get(cityKey);
  if (existingCity) {
    if (shouldCountAsExisting(state.upserts.cities, existingCity.id)) {
      markExistingUsage(state.summary.cities, existingCity.id, state.touchedExisting.cities);
    }
    return existingCity;
  }

  if (!regionId) {
    const regionlessMatches = state.citiesByName.get(normalizeKeyPart(cityName)) ?? [];
    if (regionlessMatches.length === 1) {
      const fallbackCity = regionlessMatches[0];
      if (!fallbackCity) {
        throw new Error('expected_unique_regionless_city_match');
      }
      if (shouldCountAsExisting(state.upserts.cities, fallbackCity.id)) {
        markExistingUsage(state.summary.cities, fallbackCity.id, state.touchedExisting.cities);
      }
      return fallbackCity;
    }
    if (regionlessMatches.length > 1) {
      throw createAmbiguousRegionlessCityMatchError(cityName);
    }
  }

  const city = registerCreatedRecord(state.upserts.cities, {
    id: state.createId(),
    name: cityName,
    regionId,
    createdAt: '',
    updatedAt: '',
  });
  state.cityByKey.set(cityKey, city);
  registerCityByName(state.citiesByName, city);
  state.summary.cities.created += 1;
  return city;
};

const ensureStreet = (state: PlannerState, cityId: string, streetName: string): WasteStreetRecord => {
  const streetKey = `${cityId}::${normalizeKeyPart(streetName)}`;
  const existingStreet = state.streetByKey.get(streetKey);
  if (existingStreet) {
    if (shouldCountAsExisting(state.upserts.streets, existingStreet.id)) {
      markExistingUsage(state.summary.streets, existingStreet.id, state.touchedExisting.streets);
    }
    return existingStreet;
  }

  const street = registerCreatedRecord(state.upserts.streets, {
    id: state.createId(),
    name: streetName,
    cityId,
    createdAt: '',
    updatedAt: '',
  });
  state.streetByKey.set(streetKey, street);
  state.summary.streets.created += 1;
  return street;
};

const ensureHouseNumber = (state: PlannerState, streetId: string, houseNumberValue: string): WasteHouseNumberRecord => {
  const houseNumberKey = `${streetId}::${normalizeKeyPart(houseNumberValue)}`;
  const existingHouseNumber = state.houseNumberByKey.get(houseNumberKey);
  if (existingHouseNumber) {
    if (shouldCountAsExisting(state.upserts.houseNumbers, existingHouseNumber.id)) {
      markExistingUsage(state.summary.houseNumbers, existingHouseNumber.id, state.touchedExisting.houseNumbers);
    }
    return existingHouseNumber;
  }

  const houseNumber = registerCreatedRecord(state.upserts.houseNumbers, {
    id: state.createId(),
    number: houseNumberValue,
    streetId,
    createdAt: '',
    updatedAt: '',
  });
  state.houseNumberByKey.set(houseNumberKey, houseNumber);
  state.summary.houseNumbers.created += 1;
  return houseNumber;
};

const ensureLocation = (
  state: PlannerState,
  input: { readonly regionId: string | undefined; readonly cityId: string; readonly streetId: string; readonly houseNumberId: string }
): WasteCollectionLocationRecord => {
  const locationKey = `${input.regionId ?? ''}::${input.cityId}::${input.streetId}::${input.houseNumberId}`;
  const existingLocation = state.locationByKey.get(locationKey);
  if (existingLocation) {
    if (shouldCountAsExisting(state.upserts.locations, existingLocation.id)) {
      markExistingUsage(state.summary.locations, existingLocation.id, state.touchedExisting.locations);
    }
    return existingLocation;
  }

  const location = registerCreatedRecord(state.upserts.locations, {
    id: state.createId(),
    cityId: input.cityId,
    regionId: input.regionId,
    streetId: input.streetId,
    houseNumberId: input.houseNumberId,
    active: true,
    createdAt: '',
    updatedAt: '',
  });
  state.locationByKey.set(locationKey, location);
  state.summary.locations.created += 1;
  return location;
};

const ensureFraction = (state: PlannerState, fractionName: string): WasteFractionRecord => {
  const fractionKey = normalizeKeyPart(fractionName);
  const existingFraction = state.fractionByKey.get(fractionKey);
  if (existingFraction) {
    if (shouldCountAsExisting(state.upserts.fractions, existingFraction.id)) {
      markExistingUsage(state.summary.fractions, existingFraction.id, state.touchedExisting.fractions);
      state.existingFractions.add(existingFraction.name);
    }
    return existingFraction;
  }

  const fraction = registerCreatedRecord(state.upserts.fractions, {
    id: state.createId(),
    name: fractionName,
    translations: undefined,
    containerSize: undefined,
    color: wasteLocationTourPickupDateImportDefaults.defaultFractionColor,
    description: undefined,
    active: true,
    reminderConfig: {
      reminderCount: 'none',
      channels: {
        push: false,
        email: false,
        calendar: false,
      },
    },
    createdAt: '',
    updatedAt: '',
  });
  state.fractionByKey.set(fractionKey, fraction);
  state.newFractions.add(fractionName);
  state.summary.fractions.created += 1;
  return fraction;
};

const ensureTour = (state: PlannerState, tourName: string, fractionId: string): WasteTourRecord => {
  const tourKey = normalizeKeyPart(tourName);
  const existingTour = state.tourByName.get(tourKey);
  if (!existingTour) {
    const tour = registerCreatedRecord(state.upserts.tours, {
      id: state.createId(),
      name: tourName,
      description: undefined,
      wasteFractionIds: [fractionId],
      recurrence: null,
      firstDate: undefined,
      endDate: undefined,
      customDates: undefined,
      active: true,
      locationCount: undefined,
      createdAt: '',
      updatedAt: '',
    });
    state.tourByName.set(tourKey, tour);
    state.newTours.add(tourName);
    return tour;
  }

  if (!state.newTours.has(existingTour.name) && !state.touchedExisting.tours.has(existingTour.id)) {
    state.touchedExisting.tours.add(existingTour.id);
    state.existingTours.add(existingTour.name);
  }

  if (existingTour.wasteFractionIds.includes(fractionId)) {
    return existingTour;
  }

  const nextTour = {
    ...existingTour,
    wasteFractionIds: [...existingTour.wasteFractionIds, fractionId],
  };
  state.tourByName.set(tourKey, nextTour);
  state.upserts.tours.set(nextTour.id, nextTour);
  return nextTour;
};

const ensureAssignment = (state: PlannerState, locationId: string, tourId: string): void => {
  const assignmentKey = `${locationId}::${tourId}`;
  if (state.assignmentKeys.has(assignmentKey)) {
    markExistingUsage(state.summary.assignments, assignmentKey, state.touchedExisting.assignments);
    return;
  }

  state.assignmentKeys.add(assignmentKey);
  registerCreatedRecord(state.upserts.assignments, {
    id: state.createId(),
    locationId,
    tourId,
    startDate: undefined,
    endDate: undefined,
    createdAt: '',
    updatedAt: '',
  });
  state.summary.assignments.created += 1;
};

const applyRowToPlan = (state: PlannerState, row: WasteLocationTourPickupDateImportRow): void => {
  const regionId = ensureRegion(state, row.region);
  const city = ensureCity(state, regionId, row.city);
  const street = ensureStreet(state, city.id, row.street);
  const houseNumber = ensureHouseNumber(state, street.id, row.houseNumbers);
  const location = ensureLocation(state, {
    regionId: regionId ?? city.regionId,
    cityId: city.id,
    streetId: street.id,
    houseNumberId: houseNumber.id,
  });

  for (const [fractionName, tourName] of Object.entries(row.tourNamesByFractionName)) {
    const fraction = ensureFraction(state, fractionName);
    const tour = ensureTour(state, tourName, fraction.id);
    ensureAssignment(state, location.id, tour.id);
  }
};

const toReadonlySummary = (summary: PlannerState['summary']): WasteLocationTourPickupDateImportSummary => summary;

const sortNames = (values: Set<string>): readonly string[] => [...values].sort((left, right) => left.localeCompare(right, 'de'));

export const planWasteLocationTourPickupDateImport = (
  snapshot: WasteLocationTourPickupDateImportPlanningSnapshot,
  input: { readonly rows: readonly WasteLocationTourPickupDateImportRow[] },
  options?: { readonly createId?: () => string }
): WasteLocationTourPickupDateImportPlan => {
  const state = createState(snapshot, options?.createId ?? createRuntimeUuid);

  for (const row of input.rows) {
    applyRowToPlan(state, row);
  }

  return {
    summary: toReadonlySummary(state.summary),
    existingFractions: sortNames(state.existingFractions),
    newFractions: sortNames(state.newFractions),
    existingTours: sortNames(state.existingTours),
    newTours: sortNames(state.newTours),
    upserts: {
      fractions: [...state.upserts.fractions.values()],
      regions: [...state.upserts.regions.values()],
      cities: [...state.upserts.cities.values()],
      streets: [...state.upserts.streets.values()],
      houseNumbers: [...state.upserts.houseNumbers.values()],
      locations: [...state.upserts.locations.values()],
      tours: [...state.upserts.tours.values()],
      assignments: [...state.upserts.assignments.values()],
    },
  };
};
