import { startTransition } from 'react';
import type { WasteTourStatusBulkUpdateInput } from '@sva/plugin-sdk';

import { updateWasteManagementTourStatusBulk } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteToursSubmissionContext } from './waste-management.tours.mutation-context.js';

export const createUpdateTourStatusBulkHandler =
  ({ state, pt, loadOverview }: WasteToursSubmissionContext) =>
  async (input: WasteTourStatusBulkUpdateInput): Promise<boolean> => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      const result = await updateWasteManagementTourStatusBulk(input);
      await loadOverview(true);
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt('tours.messages.statusBulkUpdateSuccess', { value: result.updatedCount }),
        });
      });
      return true;
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.messages.saveForbidden')
            : pt('tours.messages.statusBulkUpdateError'),
      });
      return false;
    } finally {
      state.setSaving(false);
    }
  };
