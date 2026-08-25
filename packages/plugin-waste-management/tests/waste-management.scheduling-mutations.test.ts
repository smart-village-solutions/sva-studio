import { describe, expect, it, vi } from 'vitest';

const deleteWasteManagementGlobalDateShiftMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementTourDateShiftMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementHolidayRuleMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementHolidayRuleMock = vi.hoisted(() => vi.fn(async () => undefined));
const createWasteManagementLocationTourPickupDateMock = vi.hoisted(() =>
  vi.fn(async () => undefined)
);
const updateWasteManagementLocationTourPickupDateMock = vi.hoisted(() =>
  vi.fn(async () => undefined)
);
const deleteWasteManagementLocationTourPickupDateMock = vi.hoisted(() =>
  vi.fn(async () => undefined)
);
const createWasteManagementTourAssignmentMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementTourAssignmentMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementTourAssignmentMock = vi.hoisted(() => vi.fn(async () => undefined));
const WasteManagementApiErrorMock = vi.hoisted(
  () =>
    class WasteManagementApiError extends Error {
      public constructor(
        public readonly code: string,
        message = code
      ) {
        super(message);
      }
    }
);

import {
  createWasteSchedulingMutationHandlers,
  WasteSchedulingRowsDeleteError,
} from '../src/waste-management.scheduling-mutations.js';

vi.mock('../src/waste-management.api.js', () => ({
  deleteWasteManagementHolidayRule: deleteWasteManagementHolidayRuleMock,
  deleteWasteManagementGlobalDateShift: deleteWasteManagementGlobalDateShiftMock,
  createWasteManagementLocationTourPickupDate: createWasteManagementLocationTourPickupDateMock,
  updateWasteManagementLocationTourPickupDate: updateWasteManagementLocationTourPickupDateMock,
  deleteWasteManagementLocationTourPickupDate: deleteWasteManagementLocationTourPickupDateMock,
  createWasteManagementTourAssignment: createWasteManagementTourAssignmentMock,
  updateWasteManagementTourAssignment: updateWasteManagementTourAssignmentMock,
  deleteWasteManagementTourAssignment: deleteWasteManagementTourAssignmentMock,
  deleteWasteManagementTourDateShift: deleteWasteManagementTourDateShiftMock,
  updateWasteManagementHolidayRule: updateWasteManagementHolidayRuleMock,
  WasteManagementApiError: WasteManagementApiErrorMock,
}));

describe('createWasteSchedulingMutationHandlers', () => {
  it('deletes mixed scheduling rows including holiday rules and reports a success message', async () => {
    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const loadOverview = vi.fn(async () => undefined);
    const pt = (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${Object.values(values).join('|')}` : key;
    const handlers = createWasteSchedulingMutationHandlers({ state, pt, loadOverview });

    await handlers.onDeleteSchedulingRows([
      {
        id: 'holiday-rule-1',
        entryType: 'holiday-rule',
        kind: 'holiday',
        originalDate: '2026-01-01',
        contextLabel: 'Neujahr',
        sortLabel: 'Neujahr',
        canDelete: true,
        rule: {} as never,
      },
      {
        id: 'global-1',
        entryType: 'global-shift',
        kind: 'global',
        originalDate: '2026-01-01',
        actualDate: '2026-01-02',
        shift: {} as never,
        contextLabel: 'alle Touren',
        sortLabel: 'alle Touren',
        canDelete: true,
      },
      {
        id: 'tour-shift-1',
        entryType: 'tour-shift',
        kind: 'tour',
        originalDate: '2026-02-01',
        actualDate: '2026-02-03',
        shift: {} as never,
        contextLabel: 'Restmüll Nord',
        sortLabel: 'Restmüll Nord',
        canDelete: true,
      },
    ]);

    expect(deleteWasteManagementHolidayRuleMock).toHaveBeenCalledWith('holiday-rule-1');
    expect(deleteWasteManagementGlobalDateShiftMock).toHaveBeenCalledWith('global-1');
    expect(deleteWasteManagementTourDateShiftMock).toHaveBeenCalledWith('tour-shift-1');
    expect(loadOverview).toHaveBeenCalledWith(true);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'scheduling.messages.deleteSuccess:3',
    });
    expect(state.setSaving).toHaveBeenNthCalledWith(1, true);
    expect(state.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('maps forbidden delete errors to the dedicated scheduling message', async () => {
    const deleteError = new WasteManagementApiErrorMock('forbidden');
    deleteWasteManagementGlobalDateShiftMock.mockRejectedValueOnce(deleteError);

    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const handlers = createWasteSchedulingMutationHandlers({
      state,
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => undefined),
    });

    const error = await handlers
      .onDeleteSchedulingRows([
        {
          id: 'global-1',
          entryType: 'global-shift',
          kind: 'global',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          shift: {} as never,
          contextLabel: 'alle Touren',
          sortLabel: 'alle Touren',
          canDelete: true,
        },
      ])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WasteSchedulingRowsDeleteError);
    expect((error as WasteSchedulingRowsDeleteError).cause).toBe(deleteError);

    expect(state.setMessage).toHaveBeenLastCalledWith({
      kind: 'error',
      text: 'scheduling.messages.deleteForbidden',
    });
  });

  it('exposes only the remaining rows after a partial sequential deletion', async () => {
    const failure = new Error('network');
    deleteWasteManagementHolidayRuleMock.mockClear();
    deleteWasteManagementGlobalDateShiftMock.mockClear();
    deleteWasteManagementTourDateShiftMock.mockClear();
    deleteWasteManagementGlobalDateShiftMock.mockRejectedValueOnce(failure);
    const rows = [
      { id: 'holiday-1', kind: 'holiday', rule: {} },
      { id: 'global-1', kind: 'global', shift: {} },
      { id: 'tour-1', kind: 'tour', shift: {} },
    ] as unknown as readonly import('../src/waste-management.scheduling.shared.js').WasteSchedulingTableEntry[];
    const handlers = createWasteSchedulingMutationHandlers({
      state: {
        setSaving: vi.fn(),
        setMessage: vi.fn(),
        setLastOutcome: vi.fn(),
      } as never,
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => undefined),
    });

    const error = await handlers.onDeleteSchedulingRows(rows).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WasteSchedulingRowsDeleteError);
    expect((error as WasteSchedulingRowsDeleteError).remainingRows.map((row) => row.id)).toEqual([
      'global-1',
      'tour-1',
    ]);
    expect(deleteWasteManagementHolidayRuleMock).toHaveBeenCalledTimes(1);
    expect(deleteWasteManagementTourDateShiftMock).not.toHaveBeenCalled();

    await handlers.onDeleteSchedulingRows((error as WasteSchedulingRowsDeleteError).remainingRows);

    expect(deleteWasteManagementHolidayRuleMock).toHaveBeenCalledTimes(1);
    expect(deleteWasteManagementGlobalDateShiftMock).toHaveBeenCalledTimes(2);
    expect(deleteWasteManagementTourDateShiftMock).toHaveBeenCalledTimes(1);
  });

  it('resolves with a warning when refresh fails after successful scheduling deletion', async () => {
    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const handlers = createWasteSchedulingMutationHandlers({
      state,
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => Promise.reject(new Error('refresh'))),
    });

    await expect(
      handlers.onDeleteSchedulingRows([
        { id: 'global-refresh', kind: 'global', shift: {} } as never,
      ])
    ).resolves.toBeUndefined();

    expect(state.setMessage).toHaveBeenLastCalledWith({
      kind: 'warning',
      text: 'scheduling.messages.refreshAfterDeleteError',
    });
  });

  it('persists holiday rule scope and strategy and reloads the overview', async () => {
    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const loadOverview = vi.fn(async () => undefined);
    const handlers = createWasteSchedulingMutationHandlers({
      state,
      pt: (key: string) => key,
      loadOverview,
    });

    await handlers.onSaveHolidayRule(
      {
        id: 'holiday-rule-1',
        holidayDate: '2026-01-01',
        holidayName: 'Neujahr',
        year: 2026,
        stateCode: 'NW',
        sourceStatus: 'confirmed',
        configurationStatus: 'draft',
        conflictStatus: 'none',
        createdAt: '2026-05-10T10:00:00.000Z',
        updatedAt: '2026-05-10T10:00:00.000Z',
      } as never,
      {
        scope: 'holiday-only',
        strategy: 'advance',
      }
    );

    expect(updateWasteManagementHolidayRuleMock).toHaveBeenCalledWith('holiday-rule-1', {
      scope: 'holiday-only',
      strategy: 'advance',
    });
    expect(loadOverview).toHaveBeenCalledWith(true);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'scheduling.holidayRules.saveSuccess',
    });
  });

  it('creates and updates generic tour assignments with multiple locations', async () => {
    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const loadOverview = vi.fn(async () => undefined);
    const handlers = createWasteSchedulingMutationHandlers({
      state,
      pt: (key: string) => key,
      loadOverview,
    });

    await handlers.onSaveTourAssignment(
      {
        id: 'pickup-1',
        locationIds: ['location-1', 'location-parent'],
        tourId: 'tour-1',
        pickupDate: '2026-07-01',
        note: ' 08:00 ',
      },
      'create'
    );
    await handlers.onSaveTourAssignment(
      {
        id: 'pickup-1',
        locationIds: ['location-1'],
        tourId: 'tour-1',
        pickupDate: '2026-07-02',
        note: '09:00',
      },
      'edit'
    );

    expect(createWasteManagementTourAssignmentMock).toHaveBeenCalledWith({
      id: 'pickup-1',
      locationIds: ['location-1', 'location-parent'],
      tourId: 'tour-1',
      pickupDate: '2026-07-01',
      note: '08:00',
    });
    expect(updateWasteManagementTourAssignmentMock).toHaveBeenCalledWith('pickup-1', {
      locationIds: ['location-1'],
      tourId: 'tour-1',
      pickupDate: '2026-07-02',
      note: '09:00',
    });
    expect(loadOverview).toHaveBeenCalledTimes(2);
    expect(state.setMessage).toHaveBeenNthCalledWith(2, {
      kind: 'success',
      text: 'scheduling.assignments.messages.createSuccess',
    });
    expect(state.setMessage).toHaveBeenNthCalledWith(4, {
      kind: 'success',
      text: 'scheduling.assignments.messages.updateSuccess',
    });
  });

  it('maps generic tour-assignment delete and save failures to dedicated messages', async () => {
    createWasteManagementTourAssignmentMock.mockRejectedValueOnce(
      new WasteManagementApiErrorMock('forbidden')
    );
    deleteWasteManagementTourAssignmentMock.mockRejectedValueOnce(
      new WasteManagementApiErrorMock('other')
    );

    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const handlers = createWasteSchedulingMutationHandlers({
      state,
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => undefined),
    });

    await expect(
      handlers.onSaveTourAssignment(
        {
          id: 'pickup-1',
          locationIds: ['location-1'],
          tourId: 'tour-1',
          pickupDate: '2026-07-01',
          note: '08:00',
        },
        'create'
      )
    ).rejects.toThrow('forbidden');

    await expect(handlers.onDeleteTourAssignment('pickup-1')).rejects.toThrow('other');

    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'scheduling.assignments.messages.saveForbidden',
    });
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'scheduling.assignments.messages.deleteError',
    });
  });

  it('keeps a successful assignment deletion when refreshing the overview fails', async () => {
    const refreshError = new Error('refresh failed');
    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const handlers = createWasteSchedulingMutationHandlers({
      state,
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => {
        throw refreshError;
      }),
    });

    await expect(handlers.onDeleteTourAssignment('pickup-1')).resolves.toBeUndefined();

    expect(deleteWasteManagementTourAssignmentMock).toHaveBeenCalledWith('pickup-1');
    expect(state.setMessage).toHaveBeenLastCalledWith({
      kind: 'warning',
      text: 'scheduling.assignments.messages.refreshAfterDeleteError',
    });
    expect(state.setSaving).toHaveBeenLastCalledWith(false);
  });
});
