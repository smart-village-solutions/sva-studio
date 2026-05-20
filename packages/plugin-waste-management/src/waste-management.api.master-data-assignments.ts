import type { WasteLocationTourLinkBulkCreateResult, WasteLocationTourLinkRecord } from '@sva/plugin-sdk';

import type {
  CreateWasteManagementLocationTourLinkInput,
  CreateWasteManagementLocationTourLinksBulkInput,
  UpdateWasteManagementLocationTourLinkInput,
} from './waste-management.api.types.js';
import { requestWasteManagementMutation } from './waste-management.api.shared.js';

export const createWasteManagementLocationTourLink = async (
  input: CreateWasteManagementLocationTourLinkInput
): Promise<WasteLocationTourLinkRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/location-tour-links', input);

export const updateWasteManagementLocationTourLink = async (
  linkId: string,
  input: UpdateWasteManagementLocationTourLinkInput
): Promise<WasteLocationTourLinkRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/location-tour-links/${encodeURIComponent(linkId)}`,
    input,
    'PUT'
  );

export const deleteWasteManagementLocationTourLink = async (linkId: string): Promise<void> => {
  await requestWasteManagementMutation(
    `/api/v1/waste-management/location-tour-links/${encodeURIComponent(linkId)}`,
    undefined,
    'DELETE'
  );
};

export const createWasteManagementLocationTourLinksBulk = async (
  input: CreateWasteManagementLocationTourLinksBulkInput
): Promise<WasteLocationTourLinkBulkCreateResult> =>
  requestWasteManagementMutation('/api/v1/waste-management/location-tour-links/bulk', input);
