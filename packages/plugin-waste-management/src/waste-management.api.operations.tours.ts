import type {
  WasteTourRecord,
  WasteTourStatusBulkUpdateResult,
  WasteTourValidityBulkUpdateResult,
} from '@sva/plugin-sdk';

import type {
  CreateWasteManagementTourInput,
  UpdateWasteManagementTourInput,
  UpdateWasteManagementTourStatusBulkInput,
  UpdateWasteManagementTourValidityBulkInput,
} from './waste-management.api.types.js';
import { requestWasteManagementMutation } from './waste-management.api.shared.js';

export const createWasteManagementTour = async (
  input: CreateWasteManagementTourInput
): Promise<WasteTourRecord> =>
  requestWasteManagementMutation('/api/v1/waste-management/tours', input);

export const updateWasteManagementTour = async (
  tourId: string,
  input: UpdateWasteManagementTourInput
): Promise<WasteTourRecord> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/tours/${encodeURIComponent(tourId)}`,
    input,
    'PUT'
  );

export const updateWasteManagementTourValidityBulk = async (
  input: UpdateWasteManagementTourValidityBulkInput
): Promise<WasteTourValidityBulkUpdateResult> =>
  requestWasteManagementMutation('/api/v1/waste-management/tours/bulk-validity', input, 'PUT');

export const updateWasteManagementTourStatusBulk = async (
  input: UpdateWasteManagementTourStatusBulkInput
): Promise<WasteTourStatusBulkUpdateResult> =>
  requestWasteManagementMutation('/api/v1/waste-management/tours/bulk-status', input, 'PUT');

export const deleteWasteManagementTour = async (
  tourId: string
): Promise<Readonly<{ id: string }>> =>
  requestWasteManagementMutation(
    `/api/v1/waste-management/tours/${encodeURIComponent(tourId)}`,
    undefined,
    'DELETE'
  );
