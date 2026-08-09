import { startTransition } from 'react';
import type { WasteTourValidityBulkUpdateInput } from '@sva/plugin-sdk';

import { updateWasteManagementTourValidityBulk } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteToursSubmissionContext } from './waste-management.tours.mutation-context.js';

export const createUpdateTourValidityBulkHandler =
  ({ state, pt, loadOverview }: WasteToursSubmissionContext) =>
  async (input: WasteTourValidityBulkUpdateInput): Promise<boolean> => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      const result = await updateWasteManagementTourValidityBulk(input);
      await loadOverview(true);
      startTransition(() => {
        state.setMessage({
          kind: 'success',
          text: pt('tours.messages.validityUpdateSuccess', { value: result.updatedCount }),
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
            : pt('tours.messages.validityUpdateError'),
      });
      return false;
    } finally {
      state.setSaving(false);
    }
  };
