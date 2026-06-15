import type {
  WasteCityRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';

import type {
  CreateWasteManagementCityInput,
  CreateWasteManagementHouseNumberInput,
  CreateWasteManagementRegionInput,
  CreateWasteManagementStreetInput,
  UpdateWasteManagementCityInput,
  UpdateWasteManagementHouseNumberInput,
  UpdateWasteManagementRegionInput,
  UpdateWasteManagementStreetInput,
} from './waste-management.api.types.js';
import { requestWasteManagementMutation } from './waste-management.api.shared.js';

const createWasteManagementRegion = async (
  input: CreateWasteManagementRegionInput
): Promise<WasteRegionRecord> => requestWasteManagementMutation('/api/v1/waste-management/regions', input);

const updateWasteManagementRegion = async (
  regionId: string,
  input: UpdateWasteManagementRegionInput
): Promise<WasteRegionRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/regions/${encodeURIComponent(regionId)}`, input, 'PUT');

const createWasteManagementCity = async (
  input: CreateWasteManagementCityInput
): Promise<WasteCityRecord> => requestWasteManagementMutation('/api/v1/waste-management/cities', input);

const updateWasteManagementCity = async (
  cityId: string,
  input: UpdateWasteManagementCityInput
): Promise<WasteCityRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/cities/${encodeURIComponent(cityId)}`, input, 'PUT');

const createWasteManagementStreet = async (
  input: CreateWasteManagementStreetInput
): Promise<WasteStreetRecord> => requestWasteManagementMutation('/api/v1/waste-management/streets', input);

const updateWasteManagementStreet = async (
  streetId: string,
  input: UpdateWasteManagementStreetInput
): Promise<WasteStreetRecord> =>
  requestWasteManagementMutation(`/api/v1/waste-management/streets/${encodeURIComponent(streetId)}`, input, 'PUT');

const createWasteManagementHouseNumber = async (
  input: CreateWasteManagementHouseNumberInput
): Promise<WasteHouseNumberRecord> => requestWasteManagementMutation('/api/v1/waste-management/house-numbers', input);

const updateWasteManagementHouseNumber = async (
  houseNumberId: string,
  input: UpdateWasteManagementHouseNumberInput
): Promise<WasteHouseNumberRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/house-numbers/${encodeURIComponent(houseNumberId)}`,
    input,
    'PUT'
  );

export {
  createWasteManagementCity,
  createWasteManagementHouseNumber,
  createWasteManagementRegion,
  createWasteManagementStreet,
  updateWasteManagementCity,
  updateWasteManagementHouseNumber,
  updateWasteManagementRegion,
  updateWasteManagementStreet,
};
