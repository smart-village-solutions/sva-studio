import { startTransition } from 'react';
import type { WasteTourStatusBulkUpdateInput } from '@sva/plugin-sdk';

import { updateWasteManagementTourStatusBulk } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteToursSubmissionContext } from './waste-management.tours.mutation-context.js';

export type WasteTourStatusUpdateResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: 'forbidden' | 'refresh' | 'write' }>;

export const createUpdateTourStatusBulkHandler =
  ({ state, pt, loadOverview }: WasteToursSubmissionContext) =>
  async (input: WasteTourStatusBulkUpdateInput): Promise<WasteTourStatusUpdateResult> => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      let result: Awaited<ReturnType<typeof updateWasteManagementTourStatusBulk>>;
      try {
        result = await updateWasteManagementTourStatusBulk(input);
      } catch (saveError) {
        return {
          ok: false,
          reason: resolveApiErrorCode(saveError) === 'forbidden' ? 'forbidden' : 'write',
        };
      }
      try {
        await loadOverview(true);
      } catch {
        return { ok: false, reason: 'refresh' };
      }
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt('tours.messages.statusBulkUpdateSuccess', { value: result.updatedCount }),
        });
      });
      return { ok: true };
    } finally {
      state.setSaving(false);
    }
  };
