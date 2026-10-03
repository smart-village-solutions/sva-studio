import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteStreetRecord,
} from './waste-management-master-data.js';
import type { PlannerState } from './waste-management-location-tour-pickup-date-planner.state.js';
import {
  normalizeKeyPart,
  registerCreatedRecord,
  shouldCountAsExisting,
  markExistingUsage,
} from './waste-management-location-tour-pickup-date-planner.state.js';

const registerCityByName = (bucket: Map<string, WasteCityRecord[]>, city: WasteCityRecord) => {
  const cityKey = normalizeKeyPart(city.name);
  const cities = bucket.get(cityKey) ?? [];
  bucket.set(cityKey, [...cities, city]);
};

const createAmbiguousRegionlessCityMatchError = (cityName: string): Error =>
  new Error(`ambiguous_regionless_city_match:${cityName}`);

export const ensureRegion = (
  state: PlannerState,
  regionName: string | undefined
): string | undefined => {
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

export const ensureCity = (
  state: PlannerState,
  regionId: string | undefined,
  cityName: string
): WasteCityRecord => {
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

export const ensureStreet = (
  state: PlannerState,
  cityId: string,
  streetName: string
): WasteStreetRecord => {
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

export const ensureHouseNumber = (
  state: PlannerState,
  streetId: string,
  houseNumberValue: string
): WasteHouseNumberRecord => {
  const houseNumberKey = `${streetId}::${normalizeKeyPart(houseNumberValue)}`;
  const existingHouseNumber = state.houseNumberByKey.get(houseNumberKey);
  if (existingHouseNumber) {
    if (shouldCountAsExisting(state.upserts.houseNumbers, existingHouseNumber.id)) {
      markExistingUsage(
        state.summary.houseNumbers,
        existingHouseNumber.id,
        state.touchedExisting.houseNumbers
      );
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

export const ensureLocation = (
  state: PlannerState,
  input: {
    readonly regionId: string | undefined;
    readonly cityId: string;
    readonly streetId: string;
    readonly houseNumberId: string;
  }
): WasteCollectionLocationRecord => {
  const locationKey = `${input.regionId ?? ''}::${input.cityId}::${input.streetId}::${input.houseNumberId}`;
  const existingLocation = state.locationByKey.get(locationKey);
  if (existingLocation) {
    if (shouldCountAsExisting(state.upserts.locations, existingLocation.id)) {
      markExistingUsage(
        state.summary.locations,
        existingLocation.id,
        state.touchedExisting.locations
      );
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
