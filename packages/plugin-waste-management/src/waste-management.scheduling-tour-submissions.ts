import { startTransition, type FormEvent } from 'react';

import {
  createWasteManagementTourDateShift,
  updateWasteManagementTourDateShift,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { toCreateTourDateShiftInput, toUpdateTourDateShiftInput } from './waste-management.scheduling.shared.js';
import type { WasteSchedulingState } from './waste-management.scheduling.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteSchedulingTourSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  onSubmitTourShift: async (event: FormEvent<HTMLFormElement>, mode = state.dialogMode) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      if (mode === 'create') {
        await createWasteManagementTourDateShift(toCreateTourDateShiftInput(state.tourShiftForm));
      } else {
        await updateWasteManagementTourDateShift(
          state.tourShiftForm.id,
          toUpdateTourDateShiftInput(state.tourShiftForm)
        );
      }
      await loadOverview(true);
      startTransition(() => {
        state.setDialogOpen(false);
        state.setLastOutcome(mode === 'create' ? 'create-success' : 'update-success');
        state.setMessage({
          kind: 'success',
          text:
            mode === 'create'
              ? pt('scheduling.tour.messages.createSuccess')
              : pt('scheduling.tour.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('scheduling.tour.messages.saveForbidden')
            : pt('scheduling.tour.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
