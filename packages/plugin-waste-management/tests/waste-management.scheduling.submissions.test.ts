import { describe, expect, it, vi } from 'vitest';

const deleteWasteManagementGlobalDateShiftMock = vi.hoisted(() => vi.fn(async () => undefined));
const deleteWasteManagementTourDateShiftMock = vi.hoisted(() => vi.fn(async () => undefined));
const WasteManagementApiErrorMock = vi.hoisted(
  () =>
    class WasteManagementApiError extends Error {
      public constructor(public readonly code: string, message = code) {
        super(message);
      }
    }
);

import { createWasteSchedulingSubmitHandlers } from '../src/waste-management.scheduling.submissions.js';

vi.mock('../src/waste-management.api.js', () => ({
  deleteWasteManagementGlobalDateShift: deleteWasteManagementGlobalDateShiftMock,
  deleteWasteManagementTourDateShift: deleteWasteManagementTourDateShiftMock,
  WasteManagementApiError: WasteManagementApiErrorMock,
}));

describe('createWasteSchedulingSubmitHandlers', () => {
  it('deletes mixed scheduling rows and reports a success message', async () => {
    const state = {
      setSaving: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;
    const loadOverview = vi.fn(async () => undefined);
    const pt = (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${Object.values(values).join('|')}` : key;
    const handlers = createWasteSchedulingSubmitHandlers({ state, pt, loadOverview });

    await handlers.onDeleteSchedulingRows([
      {
        id: 'global-1',
        kind: 'global',
        shift: {} as never,
        contextLabel: 'alle Touren',
        sortLabel: 'alle Touren',
      },
      {
        id: 'tour-shift-1',
        kind: 'tour',
        shift: {} as never,
        contextLabel: 'Restmüll Nord',
        sortLabel: 'Restmüll Nord',
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
    const handlers = createWasteSchedulingSubmitHandlers({
      state,
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => undefined),
    });

    await handlers.onDeleteSchedulingRows([
      {
        id: 'global-1',
        kind: 'global',
        shift: {} as never,
        contextLabel: 'alle Touren',
        sortLabel: 'alle Touren',
      },
    ]);

    expect(state.setMessage).toHaveBeenCalledWith({
      kind: 'error',
      text: 'scheduling.messages.deleteForbidden',
    });
  });
});
