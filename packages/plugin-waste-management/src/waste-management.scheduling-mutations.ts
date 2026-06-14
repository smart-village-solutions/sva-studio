import type { WasteHolidayRuleRecord } from '@sva/plugin-sdk';
import { startTransition } from 'react';

import {
  createWasteManagementLocationTourPickupDate,
  deleteWasteManagementHolidayRule,
  deleteWasteManagementGlobalDateShift,
  deleteWasteManagementLocationTourPickupDate,
  deleteWasteManagementTourDateShift,
  updateWasteManagementLocationTourPickupDate,
  updateWasteManagementHolidayRule,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
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

const deleteSchedulingRows = async (rows: readonly WasteSchedulingTableEntry[]) => {
  for (const row of rows) {
    if (row.kind === 'holiday') {
      await deleteWasteManagementHolidayRule(row.id);
      continue;
    }
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

const createDeleteSchedulingRowsHandler = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => async (rows: readonly WasteSchedulingTableEntry[]) => {
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

const createSaveLocationTourPickupDateHandler = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => async (
  input: {
    readonly id: string;
    readonly locationId: string;
    readonly tourId: string;
    readonly pickupDate: string;
    readonly note: string;
  },
  mode: 'create' | 'edit',
) => {
  resetSchedulingFeedback(state);
  try {
    if (mode === 'create') {
      await createWasteManagementLocationTourPickupDate(input);
    } else {
      await updateWasteManagementLocationTourPickupDate(input.id, {
        locationId: input.locationId,
        tourId: input.tourId,
        pickupDate: input.pickupDate,
        note: input.note,
      });
    }
    await loadOverview(true);
    startTransition(() => {
      state.setMessage({
        kind: 'success',
        text:
          mode === 'create'
            ? pt('scheduling.schadstoffmobil.messages.createSuccess')
            : pt('scheduling.schadstoffmobil.messages.updateSuccess'),
      });
    });
  } catch (error) {
    state.setMessage(
      createSchedulingErrorMessage(
        pt,
        resolveApiErrorCode(error),
        'scheduling.schadstoffmobil.messages.saveError',
        'scheduling.schadstoffmobil.messages.saveForbidden'
      )
    );
    throw error;
  } finally {
    state.setSaving(false);
  }
};

const createDeleteLocationTourPickupDateHandler = ({
  state,
  pt,
  loadOverview,
}: {
  readonly state: WasteSchedulingState;
  readonly pt: Translate;
  readonly loadOverview: (active?: boolean) => Promise<void>;
}) => async (pickupDateId: string) => {
  resetSchedulingFeedback(state);
  try {
    await deleteWasteManagementLocationTourPickupDate(pickupDateId);
    await loadOverview(true);
    state.setMessage({
      kind: 'success',
      text: pt('scheduling.schadstoffmobil.messages.deleteSuccess'),
    });
  } catch (error) {
    state.setMessage(
      createSchedulingErrorMessage(
        pt,
        resolveApiErrorCode(error),
        'scheduling.schadstoffmobil.messages.deleteError',
        'scheduling.schadstoffmobil.messages.deleteForbidden'
      )
    );
    throw error;
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
  onSaveHolidayRule: createSaveHolidayRuleHandler({ state, pt, loadOverview }),
  onDeleteSchedulingRows: createDeleteSchedulingRowsHandler({ state, pt, loadOverview }),
  onSaveLocationTourPickupDate: createSaveLocationTourPickupDateHandler({ state, pt, loadOverview }),
  onDeleteLocationTourPickupDate: createDeleteLocationTourPickupDateHandler({ state, pt, loadOverview }),
});
