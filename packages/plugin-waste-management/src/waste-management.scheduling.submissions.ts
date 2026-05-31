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

const resetSchedulingFeedback = (state: WasteSchedulingState) => {
  state.setSaving(true);
  state.setMessage(null);
  state.setLastOutcome(null);
};

const createSchedulingErrorMessage = (
  pt: Translate,
  code: string | null | undefined,
  fallbackKey: string,
  forbiddenKey: string
) => ({
  kind: 'error' as const,
  text: code === 'forbidden' ? pt(forbiddenKey) : pt(fallbackKey),
});

const deleteSchedulingRows = async (rows: readonly WasteSchedulingTableRow[]) => {
  for (const row of rows) {
    if (row.kind === 'global') {
      await deleteWasteManagementGlobalDateShift(row.id);
      continue;
    }
    await deleteWasteManagementTourDateShift(row.id);
  }
};

const createSaveHolidayRuleHandler = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => async (
  rule: WasteHolidayRuleRecord,
  input: {
    readonly scope?: WasteHolidayRuleRecord['scope'];
    readonly strategy?: WasteHolidayRuleRecord['strategy'];
  }
) => {
  resetSchedulingFeedback(state);
  try {
    await updateWasteManagementHolidayRule(rule.id, input);
    await loadOverview(true);
    state.setMessage({
      kind: 'success',
      text: pt('scheduling.holidayRules.saveSuccess'),
    });
  } catch (error) {
    state.setMessage(
      createSchedulingErrorMessage(
        pt,
        resolveApiErrorCode(error),
        'scheduling.holidayRules.saveError',
        'scheduling.holidayRules.saveForbidden'
      )
    );
  } finally {
    state.setSaving(false);
  }
};

const createRunHolidaySyncHandler = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => async () => {
  resetSchedulingFeedback(state);
  try {
    const response = await startWasteManagementHolidaySync();
    await loadOverview(true);
    state.setMessage({
      kind: 'success',
      text: pt('scheduling.holidayRules.syncSuccess', { value: response?.lastHolidaySyncStatus ?? 'success' }),
    });
  } catch (error) {
    state.setMessage(
      createSchedulingErrorMessage(
        pt,
        resolveApiErrorCode(error),
        'scheduling.holidayRules.syncError',
        'scheduling.holidayRules.syncForbidden'
      )
    );
  } finally {
    state.setSaving(false);
  }
};

const createDeleteSchedulingRowsHandler = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => async (rows: readonly WasteSchedulingTableRow[]) => {
  resetSchedulingFeedback(state);
  try {
    await deleteSchedulingRows(rows);
    await loadOverview(true);
    state.setMessage({
      kind: 'success',
      text: pt('scheduling.messages.deleteSuccess', { value: rows.length }),
    });
  } catch (error) {
    state.setMessage(
      createSchedulingErrorMessage(
        pt,
        resolveApiErrorCode(error),
        'scheduling.messages.deleteError',
        'scheduling.messages.deleteForbidden'
      )
    );
  } finally {
    state.setSaving(false);
  }
};

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
  onSaveHolidayRule: createSaveHolidayRuleHandler({ state, pt, loadOverview }),
  onRunHolidaySync: createRunHolidaySyncHandler({ state, pt, loadOverview }),
  onDeleteSchedulingRows: createDeleteSchedulingRowsHandler({ state, pt, loadOverview }),
});
