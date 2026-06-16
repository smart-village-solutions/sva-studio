import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendWasteManagementDebugLogMock = vi.hoisted(() => vi.fn());
const resolveApiErrorCodeMock = vi.hoisted(() => vi.fn());

vi.mock('../src/waste-management.api.js', () => ({
  appendWasteManagementDebugLog: appendWasteManagementDebugLogMock,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  resolveApiErrorCode: resolveApiErrorCodeMock,
}));

import {
  logWasteTourDeleteError,
  logWasteTourDeleteStart,
  logWasteTourDeleteSuccess,
} from '../src/waste-management.tours.delete-debug.js';

describe('waste-management tour delete debug logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveApiErrorCodeMock.mockReturnValue('invalid_request');
  });

  it('writes start, success, and error debug entries with the resolved error metadata', () => {
    logWasteTourDeleteStart({ id: 'tour-1', name: 'Restmuell' });
    logWasteTourDeleteSuccess({ id: 'tour-1', name: 'Restmuell' });
    logWasteTourDeleteError({ id: 'tour-1', name: 'Restmuell' }, new Error('Delete failed'));

    expect(appendWasteManagementDebugLogMock).toHaveBeenNthCalledWith(1, {
      phase: 'start',
      scope: 'tour-delete',
      tourId: 'tour-1',
      tourName: 'Restmuell',
    });
    expect(appendWasteManagementDebugLogMock).toHaveBeenNthCalledWith(2, {
      phase: 'success',
      scope: 'tour-delete',
      tourId: 'tour-1',
      tourName: 'Restmuell',
    });
    expect(appendWasteManagementDebugLogMock).toHaveBeenNthCalledWith(3, {
      errorCode: 'invalid_request',
      errorMessage: 'Delete failed',
      phase: 'error',
      scope: 'tour-delete',
      tourId: 'tour-1',
      tourName: 'Restmuell',
    });
  });
});
