import type {
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/plugin-sdk';

import type {
  CreateWasteAnnualTourTransferInput,
  PreviewWasteAnnualTourTransferInput,
} from './waste-management.api.types.js';
import {
  requestWasteManagementIdempotentMutation,
  requestWasteManagementMutation,
} from './waste-management.api.shared.js';

export const previewWasteAnnualTourTransfer = async (
  input: PreviewWasteAnnualTourTransferInput
): Promise<WasteAnnualTourTransferPreview> =>
  requestWasteManagementMutation('/api/v1/waste-management/tours/annual-transfer/preview', input);

export const createWasteAnnualTourTransfer = async (
  input: CreateWasteAnnualTourTransferInput,
  idempotencyKey: string
): Promise<WasteAnnualTourTransferResult> =>
  requestWasteManagementIdempotentMutation(
    '/api/v1/waste-management/tours/annual-transfer',
    input,
    idempotencyKey
  );
