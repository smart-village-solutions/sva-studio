import { describe, expect, it, vi } from 'vitest';

const deleteWasteManagementGlobalDateShiftMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementTourDateShiftMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementHolidayRuleMock = vi.hoisted(() => vi.fn(async () => undefined));
const WasteManagementApiErrorMock = vi.hoisted(
  () =>
    class WasteManagementApiError extends Error {
      public constructor(public readonly code: string, message = code) {
        super(message);
      }
    }
);

import { createWasteSchedulingMutationHandlers } from '../src/waste-management.scheduling-mutations.js';

vi.mock('../src/waste-management.api.js', () => ({
  deleteWasteManagementGlobalDateShift: deleteWasteManagementGlobalDateShiftMock,
  deleteWasteManagementTourDateShift: deleteWasteManagementTourDateShiftMock,
  updateWasteManagementHolidayRule: updateWasteManagementHolidayRuleMock,
  WasteManagementApiError: WasteManagementApiErrorMock,
}));

describe('createWasteSchedulingMutationHandlers', () => {
  it('deletes mixed scheduling rows and reports a success message', async () => {
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

    expect(deleteWasteManagementGlobalDateShiftMock).toHaveBeenCalledWith('global-1');
    expect(deleteWasteManagementTourDateShiftMock).toHaveBeenCalledWith('tour-shift-1');
    expect(loadOverview).toHaveBeenCalledWith(true);
    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'success',
      text: 'scheduling.messages.deleteSuccess:2',
    });
    expect(state.setSaving).toHaveBeenNthCalledWith(1, true);
    expect(state.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('maps forbidden delete errors to the dedicated scheduling message', async () => {
    deleteWasteManagementGlobalDateShiftMock.mockRejectedValueOnce(
      new WasteManagementApiErrorMock('forbidden')
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

    await handlers.onDeleteSchedulingRows([
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
    ]);

    expect(state.setMessage).toHaveBeenLastCalledWith({
      kind: 'error',
      text: 'scheduling.messages.deleteForbidden',
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

    await handlers.onSaveHolidayRule({
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
    } as never, {
      scope: 'holiday-only',
      strategy: 'advance',
    });

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
});
