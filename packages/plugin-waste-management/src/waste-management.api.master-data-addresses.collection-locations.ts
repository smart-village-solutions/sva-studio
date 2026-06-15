import type { WasteCollectionLocationRecord } from '@sva/plugin-sdk';

import type {
  CreateWasteManagementCollectionLocationInput,
  UpdateWasteManagementCollectionLocationInput,
} from './waste-management.api.types.js';
import { requestWasteManagementMutation } from './waste-management.api.shared.js';

const createWasteManagementCollectionLocation = async (
  input: CreateWasteManagementCollectionLocationInput
): Promise<WasteCollectionLocationRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/collection-locations', input);

const updateWasteManagementCollectionLocation = async (
  locationId: string,
  input: UpdateWasteManagementCollectionLocationInput
): Promise<WasteCollectionLocationRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/collection-locations/${encodeURIComponent(locationId)}`,
    input,
    'PUT'
  );

const deleteWasteManagementCollectionLocation = async (
  locationId: string
): Promise<Readonly<{ id: string }>> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/collection-locations/${encodeURIComponent(locationId)}`,
    undefined,
    'DELETE'
  );

export {
  createWasteManagementCollectionLocation,
  deleteWasteManagementCollectionLocation,
  updateWasteManagementCollectionLocation,
};
