import type { WasteHolidayRuleRecord } from '@sva/plugin-sdk';
import {
  deleteWasteManagementHolidayRule,
  deleteWasteManagementGlobalDateShift,
  deleteWasteManagementTourDateShift,
  updateWasteManagementHolidayRule,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import { createWasteSchedulingAssignmentMutationHandlers } from './waste-management.scheduling-assignment-mutations.js';
import { createWasteSchedulingGlobalMutationHandlers } from './waste-management.scheduling-global-mutations.js';
import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';
import { createWasteSchedulingTourMutationHandlers } from './waste-management.scheduling-tour-mutations.js';
import type { WasteSchedulingState } from './use-waste-scheduling-state.js';

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

export class WasteSchedulingRowsDeleteError extends Error {
  public constructor(
    public readonly remainingRows: readonly WasteSchedulingTableEntry[],
    public readonly cause: unknown
  ) {
    super('Some scheduling rows could not be deleted');
    this.name = 'WasteSchedulingRowsDeleteError';
  }
}

const deleteSchedulingRow = async (row: WasteSchedulingTableEntry) => {
  if (row.kind === 'holiday') {
    await deleteWasteManagementHolidayRule(row.id);
    return;
  }
  if (row.kind === 'global') {
    await deleteWasteManagementGlobalDateShift(row.id);
    return;
  }
  await deleteWasteManagementTourDateShift(row.id);
};

const deleteSchedulingRows = async (rows: readonly WasteSchedulingTableEntry[]) => {
  for (const [index, row] of rows.entries()) {
    try {
      await deleteSchedulingRow(row);
    } catch (error) {
      if (resolveApiErrorCode(error) === 'not_found') continue;
      throw new WasteSchedulingRowsDeleteError(rows.slice(index), error);
    }
  }
};

const createSaveHolidayRuleHandler =
  ({
    state,
    pt,
    loadOverview,
  }: {
    readonly state: WasteSchedulingState;
    readonly pt: Translate;
    readonly loadOverview: (active?: boolean) => Promise<void>;
  }) =>
  async (
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
      state.setLastOutcome('update-success');
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

const createDeleteSchedulingRowsHandler =
  ({
    state,
    pt,
    loadOverview,
  }: {
    readonly state: WasteSchedulingState;
    readonly pt: Translate;
    readonly loadOverview: (active?: boolean) => Promise<void>;
  }) =>
  async (rows: readonly WasteSchedulingTableEntry[]) => {
    resetSchedulingFeedback(state);
    try {
      try {
        await deleteSchedulingRows(rows);
      } catch (error) {
        const cause = error instanceof WasteSchedulingRowsDeleteError ? error.cause : error;
        state.setMessage(
          createSchedulingErrorMessage(
            pt,
            resolveApiErrorCode(cause),
            'scheduling.messages.deleteError',
            'scheduling.messages.deleteForbidden'
          )
        );
        throw error;
      }
      try {
        await loadOverview(true);
      } catch {
        state.setMessage({
          kind: 'warning',
          text: pt('scheduling.messages.refreshAfterDeleteError'),
        });
        return;
      }
      state.setMessage({
        kind: 'success',
        text: pt('scheduling.messages.deleteSuccess', { value: rows.length }),
      });
    } finally {
      state.setSaving(false);
    }
  };

export const createWasteSchedulingMutationHandlers = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => ({
  ...createWasteSchedulingTourMutationHandlers({ state, pt, loadOverview }),
  ...createWasteSchedulingGlobalMutationHandlers({ state, pt, loadOverview }),
  ...createWasteSchedulingAssignmentMutationHandlers({ state, pt, loadOverview }),
  onSaveHolidayRule: createSaveHolidayRuleHandler({ state, pt, loadOverview }),
  onDeleteSchedulingRows: createDeleteSchedulingRowsHandler({ state, pt, loadOverview }),
});
