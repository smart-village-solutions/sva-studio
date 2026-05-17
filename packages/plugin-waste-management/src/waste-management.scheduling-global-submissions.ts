import { startTransition, type FormEvent } from 'react';

import {
  createWasteManagementGlobalDateShift,
  updateWasteManagementGlobalDateShift,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { toCreateGlobalDateShiftInput, toUpdateGlobalDateShiftInput } from './waste-management.scheduling.shared.js';
import type { WasteSchedulingState } from './waste-management.scheduling.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteSchedulingGlobalSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  onSubmitGlobalShift: async (event: FormEvent<HTMLFormElement>, mode = state.globalDialogMode) => {
    event.preventDefault();
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      if (mode === 'create') {
        await createWasteManagementGlobalDateShift(toCreateGlobalDateShiftInput(state.globalShiftForm));
      } else {
        await updateWasteManagementGlobalDateShift(
          state.globalShiftForm.id,
          toUpdateGlobalDateShiftInput(state.globalShiftForm)
        );
      }
      await loadOverview(true);
      startTransition(() => {
        state.setGlobalDialogOpen(false);
        state.setLastOutcome(mode === 'create' ? 'create-global-success' : 'update-global-success');
        state.setMessage({
          kind: 'success',
          text:
            mode === 'create'
              ? pt('scheduling.global.messages.createSuccess')
              : pt('scheduling.global.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('scheduling.global.messages.saveForbidden')
            : pt('scheduling.global.messages.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
