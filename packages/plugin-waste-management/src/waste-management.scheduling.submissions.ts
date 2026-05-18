import { createWasteSchedulingGlobalSubmitHandlers } from './waste-management.scheduling-global-submissions.js';
import { createWasteSchedulingTourSubmitHandlers } from './waste-management.scheduling-tour-submissions.js';
import {
  deleteWasteManagementGlobalDateShift,
  deleteWasteManagementTourDateShift,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteSchedulingTableRow } from './waste-management.scheduling.shared.js';
import type { WasteSchedulingState } from './waste-management.scheduling.state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteSchedulingSubmitHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  ...createWasteSchedulingTourSubmitHandlers({ state, pt, loadOverview }),
  ...createWasteSchedulingGlobalSubmitHandlers({ state, pt, loadOverview }),
  onDeleteSchedulingRows: async (rows: readonly WasteSchedulingTableRow[]) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      for (const row of rows) {
        if (row.kind === 'global') {
          await deleteWasteManagementGlobalDateShift(row.id);
          continue;
        }
        await deleteWasteManagementTourDateShift(row.id);
      }
      await loadOverview(true);
      state.setMessage({
        kind: 'success',
        text: pt('scheduling.messages.deleteSuccess', { value: rows.length }),
      });
    } catch (error) {
      const code = resolveApiErrorCode(error);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('scheduling.messages.deleteForbidden')
            : pt('scheduling.messages.deleteError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
});
