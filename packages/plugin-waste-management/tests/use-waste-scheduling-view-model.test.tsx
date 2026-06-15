import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWasteSchedulingViewModel } from '../src/use-waste-scheduling-view-model.js';
import type { WasteManagementSearchParams } from '../src/search-params.js';

const useWasteSchedulingStateMock = vi.hoisted(() => vi.fn());
const useWasteSchedulingOverviewMock = vi.hoisted(() => vi.fn());
const schedulingActionsMock = vi.hoisted(() => vi.fn(() => ({ openCreateTourShiftDialog: vi.fn() })));
const schedulingMutationsMock = vi.hoisted(() => vi.fn(() => ({ onDeleteSchedulingRows: vi.fn() })));
const schedulingTableEntriesMock = vi.hoisted(() => vi.fn(() => [{ id: 'row-1' }]));
const filterSchedulingTableEntriesMock = vi.hoisted(() => vi.fn((entries: unknown) => entries));

vi.mock('../src/use-waste-scheduling-state.js', () => ({
  useWasteSchedulingState: () => useWasteSchedulingStateMock(),
}));

vi.mock('../src/use-waste-scheduling-overview.js', () => ({
  useWasteSchedulingOverview: (...args: unknown[]) => useWasteSchedulingOverviewMock(...args),
}));

vi.mock('../src/waste-management.scheduling.actions.js', () => ({
  createWasteSchedulingActions: (...args: unknown[]) => schedulingActionsMock(...args),
}));

vi.mock('../src/waste-management.scheduling-mutations.js', () => ({
  createWasteSchedulingMutationHandlers: (...args: unknown[]) => schedulingMutationsMock(...args),
}));

vi.mock('../src/waste-management.scheduling.shared.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.scheduling.shared.js')>(
    '../src/waste-management.scheduling.shared.js'
  );

  return {
    ...actual,
    createSchedulingTableEntries: (...args: unknown[]) => schedulingTableEntriesMock(...args),
    filterSchedulingTableEntries: (...args: unknown[]) => filterSchedulingTableEntriesMock(...args),
  };
});

vi.mock('../src/waste-management.tours.locations.js', () => ({
  formatCollectionLocationLabel: (_pt: unknown, _overview: unknown, location: { id: string; name?: string }) => location.name ?? location.id,
}));

const search: WasteManagementSearchParams = {
  tab: 'scheduling',
  masterDataTab: 'fractions',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'list',
  q: '',
  page: 1,
  pageSize: 25,
  status: 'all',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
};

describe('useWasteSchedulingViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWasteSchedulingOverviewMock.mockReturnValue(vi.fn());
  });

  it('resolves schadstoffmobil assignments and sorted location options from overview state', () => {
    const state = {
      overview: {
        holidayRules: [],
        globalDateShifts: [],
        tourDateShifts: [],
        locationTourPickupDates: [
          { id: 'pickup-1', tourId: 'tour-1', locationId: 'location-2', pickupDate: '2026-07-01', note: '08:00' },
          { id: 'pickup-2', tourId: 'tour-2', locationId: 'location-1', pickupDate: '2026-07-02', note: '09:00' },
        ],
      },
      availableTours: [
        { id: 'tour-1', name: '  schadstoffmobil ' },
        { id: 'tour-2', name: 'Restmüll' },
      ],
      locationOverview: {
        collectionLocations: [
          { id: 'location-2', name: 'Ziegelhof' },
          { id: 'location-1', name: 'Albertplatz' },
          { id: 'location-3', name: 'Ohne Link' },
        ],
        locationTourLinks: [
          { id: 'link-1', locationId: 'location-2', tourId: 'tour-1' },
          { id: 'link-2', locationId: 'location-1', tourId: 'tour-1' },
          { id: 'link-3', locationId: 'location-3', tourId: 'tour-2' },
        ],
      },
    };
    useWasteSchedulingStateMock.mockReturnValue(state);

    const { result } = renderHook(() => useWasteSchedulingViewModel((key) => key, search));

    expect(result.current.schadstoffmobilTour).toEqual({ id: 'tour-1', name: '  schadstoffmobil ' });
    expect(result.current.schadstoffmobilAssignments).toEqual([
      { id: 'pickup-1', tourId: 'tour-1', locationId: 'location-2', pickupDate: '2026-07-01', note: '08:00' },
    ]);
    expect(result.current.schadstoffmobilLocationOptions).toEqual([
      { id: 'location-1', label: 'Albertplatz' },
      { id: 'location-2', label: 'Ziegelhof' },
    ]);
    expect(result.current.openCreateTourShiftDialog).toBeTypeOf('function');
    expect(result.current.onDeleteSchedulingRows).toBeTypeOf('function');
    expect(filterSchedulingTableEntriesMock).toHaveBeenCalledWith([{ id: 'row-1' }], search);
  });

  it('returns empty schadstoffmobil collections when no matching tour or locations are present', () => {
    const state = {
      overview: null,
      availableTours: [{ id: 'tour-2', name: 'Biotonne' }],
      locationOverview: null,
    };
    useWasteSchedulingStateMock.mockReturnValue(state);

    const { result } = renderHook(() => useWasteSchedulingViewModel((key) => key, search));

    expect(result.current.schadstoffmobilTour).toBeNull();
    expect(result.current.schadstoffmobilAssignments).toEqual([]);
    expect(result.current.schadstoffmobilLocationOptions).toEqual([]);
    expect(schedulingTableEntriesMock).toHaveBeenCalledWith({
      holidayRules: [],
      globalDateShifts: [],
      tourDateShifts: [],
      availableTours: [{ id: 'tour-2', name: 'Biotonne' }],
      pt: expect.any(Function),
    });
  });
});
