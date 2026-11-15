import type { StudioJobResponse } from '@sva/plugin-sdk';
import type {
  WasteFractionRecord,
  WasteFractionDeleteInput,
  WasteFractionDeleteConfirmation,
  WasteFractionDeletePreview,
} from '@sva/waste-management-contracts';

import type {
  CreateWasteManagementFractionInput,
  UpdateWasteManagementFractionInput,
} from './waste-management.api.types.js';
import {
  requestWasteManagementMutation,
  requestWasteManagementMutationResponse,
} from './waste-management.api.shared.js';

type WasteFractionSyncStatus = 'queued' | 'failed';

type WasteFractionMutationResponse<T> = Readonly<{
  data: T;
  requestId?: string;
  syncStatus?: WasteFractionSyncStatus;
  syncJob?: StudioJobResponse['data'];
}>;

const createWasteManagementFraction = async (
  input: CreateWasteManagementFractionInput
): Promise<WasteFractionMutationResponse<WasteFractionRecord>> =>
  requestWasteManagementMutationResponse('/api/v1/waste-management/fractions', input);

const updateWasteManagementFraction = async (
  fractionId: string,
  input: UpdateWasteManagementFractionInput
): Promise<WasteFractionMutationResponse<WasteFractionRecord>> =>
  requestWasteManagementMutationResponse(
    `/api/v1/waste-management/fractions/${encodeURIComponent(fractionId)}`,
    input,
    'PUT'
  );

const deleteWasteManagementFraction = async (
  fractionId: string,
  confirmation?: Omit<WasteFractionDeleteConfirmation, 'fractionId'>
): Promise<WasteFractionMutationResponse<{ readonly id: string }>> =>
  requestWasteManagementMutationResponse(
    `/api/v1/waste-management/fractions/${encodeURIComponent(fractionId)}`,
    confirmation,
    'DELETE'
  );

export {
  createWasteManagementFraction,
  deleteWasteManagementFraction,
  updateWasteManagementFraction,
};
export type { WasteFractionMutationResponse, WasteFractionSyncStatus };

export const previewWasteManagementFractionDeletion = (
  input: WasteFractionDeleteInput
): Promise<WasteFractionDeletePreview> =>
  requestWasteManagementMutation('/api/v1/waste-management/fractions/impact-preview', input);
