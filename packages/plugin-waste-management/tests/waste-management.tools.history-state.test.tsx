import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWasteManagementHistoryOverviewMock = vi.hoisted(() => vi.fn());

vi.mock('../src/waste-management.api.js', () => ({
  getWasteManagementHistoryOverview: getWasteManagementHistoryOverviewMock,
}));

import { useWasteTechnicalHistory } from '../src/waste-management.tools.history-state.js';

describe('useWasteTechnicalHistory', () => {
  beforeEach(() => {
    getWasteManagementHistoryOverviewMock.mockReset();
  });

  it('preserves loaded history and propagates an explicitly observed refresh failure', async () => {
    getWasteManagementHistoryOverviewMock.mockResolvedValueOnce({
      technical: { items: [{ id: 'job-1' }] },
    });
    const { result } = renderHook(() => useWasteTechnicalHistory());
    await waitFor(() => expect(result.current.technicalHistory).toEqual([{ id: 'job-1' }]));

    getWasteManagementHistoryOverviewMock.mockRejectedValueOnce(new Error('refresh failed'));
    await act(async () => {
      await expect(result.current.refreshTechnicalHistory(true)).rejects.toThrow('refresh failed');
    });

    expect(result.current.technicalHistory).toEqual([{ id: 'job-1' }]);
  });
});
