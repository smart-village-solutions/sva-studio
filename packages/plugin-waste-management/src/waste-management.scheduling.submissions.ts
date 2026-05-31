import { createWasteSchedulingGlobalSubmitHandlers } from './waste-management.scheduling-global-submissions.js';
import { createWasteSchedulingTourSubmitHandlers } from './waste-management.scheduling-tour-submissions.js';
import {
  deleteWasteManagementGlobalDateShift,
  deleteWasteManagementTourDateShift,
  startWasteManagementHolidaySync,
  updateWasteManagementHolidayRule,
} from './waste-management.api.js';
import type { WasteHolidayRuleRecord } from '@sva/plugin-sdk';
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
  onSaveHolidayRule: async (
    rule: WasteHolidayRuleRecord,
    input: {
      readonly scope?: WasteHolidayRuleRecord['scope'];
      readonly strategy?: WasteHolidayRuleRecord['strategy'];
    }
  ) => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      await updateWasteManagementHolidayRule(rule.id, input);
      await loadOverview(true);
      state.setMessage({
        kind: 'success',
        text: pt('scheduling.holidayRules.saveSuccess'),
      });
    } catch (error) {
      const code = resolveApiErrorCode(error);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('scheduling.holidayRules.saveForbidden')
            : pt('scheduling.holidayRules.saveError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
  onRunHolidaySync: async () => {
    state.setSaving(true);
    state.setMessage(null);
    state.setLastOutcome(null);
    try {
      const response = await startWasteManagementHolidaySync();
      await loadOverview(true);
      state.setMessage({
        kind: 'success',
        text: pt('scheduling.holidayRules.syncSuccess', { value: response?.lastHolidaySyncStatus ?? 'success' }),
      });
    } catch (error) {
      const code = resolveApiErrorCode(error);
      state.setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('scheduling.holidayRules.syncForbidden')
            : pt('scheduling.holidayRules.syncError'),
      });
    } finally {
      state.setSaving(false);
    }
  },
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
