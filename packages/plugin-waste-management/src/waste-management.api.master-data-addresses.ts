import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';

import type {
  CreateWasteManagementCityInput,
  CreateWasteManagementCollectionLocationInput,
  CreateWasteManagementFractionInput,
  CreateWasteManagementHouseNumberInput,
  CreateWasteManagementRegionInput,
  CreateWasteManagementStreetInput,
  UpdateWasteManagementCityInput,
  UpdateWasteManagementCollectionLocationInput,
  UpdateWasteManagementFractionInput,
  UpdateWasteManagementHouseNumberInput,
  UpdateWasteManagementRegionInput,
  UpdateWasteManagementStreetInput,
} from './waste-management.api.types.js';
import { requestWasteManagementMutation } from './waste-management.api.shared.js';

export const createWasteManagementFraction = async (
  input: CreateWasteManagementFractionInput
): Promise<WasteFractionRecord> => requestWasteManagementMutation('/api/v1/waste-management/fractions', input);

export const updateWasteManagementFraction = async (
  fractionId: string,
  input: UpdateWasteManagementFractionInput
): Promise<WasteFractionRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/fractions/${encodeURIComponent(fractionId)}`, input, 'PUT');

export const createWasteManagementRegion = async (
  input: CreateWasteManagementRegionInput
): Promise<WasteRegionRecord> => requestWasteManagementMutation('/api/v1/waste-management/regions', input);

export const updateWasteManagementRegion = async (
  regionId: string,
  input: UpdateWasteManagementRegionInput
): Promise<WasteRegionRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/regions/${encodeURIComponent(regionId)}`, input, 'PUT');

export const createWasteManagementCity = async (
  input: CreateWasteManagementCityInput
): Promise<WasteCityRecord> => requestWasteManagementMutation('/api/v1/waste-management/cities', input);

export const updateWasteManagementCity = async (
  cityId: string,
  input: UpdateWasteManagementCityInput
): Promise<WasteCityRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/cities/${encodeURIComponent(cityId)}`, input, 'PUT');

export const createWasteManagementStreet = async (
  input: CreateWasteManagementStreetInput
): Promise<WasteStreetRecord> => requestWasteManagementMutation('/api/v1/waste-management/streets', input);

export const updateWasteManagementStreet = async (
  streetId: string,
  input: UpdateWasteManagementStreetInput
): Promise<WasteStreetRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/streets/${encodeURIComponent(streetId)}`, input, 'PUT');

export const createWasteManagementHouseNumber = async (
  input: CreateWasteManagementHouseNumberInput
): Promise<WasteHouseNumberRecord> => requestWasteManagementMutation('/api/v1/waste-management/house-numbers', input);

export const updateWasteManagementHouseNumber = async (
  houseNumberId: string,
  input: UpdateWasteManagementHouseNumberInput
): Promise<WasteHouseNumberRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/house-numbers/${encodeURIComponent(houseNumberId)}`,
    input,
    'PUT'
  );

export const createWasteManagementCollectionLocation = async (
  input: CreateWasteManagementCollectionLocationInput
): Promise<WasteCollectionLocationRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/collection-locations', input);

export const updateWasteManagementCollectionLocation = async (
  locationId: string,
  input: UpdateWasteManagementCollectionLocationInput
): Promise<WasteCollectionLocationRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/collection-locations/${encodeURIComponent(locationId)}`,
    input,
    'PUT'
  );
