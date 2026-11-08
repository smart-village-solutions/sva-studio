import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWasteToursViewModel } from '../src/use-waste-tours-view-model.js';
import type { WasteManagementSearchParams } from '../src/search-params.js';

const loadOverviewMock = vi.fn();

const state = vi.hoisted(() => ({
  current: {
    loading: false,
    overview: null,
    availableFractions: [],
    customRecurrencePresets: [],
    masterDataOverview: null,
    assignmentContextLoading: false,
    schedulingOverview: null,
    error: null,
    dialogOpen: false,
    dialogMode: 'edit' as const,
    tourForm: {
      id: 'tour-1',
      dateLocationAssignments: [],
    },
    assignmentsDialogOpen: false,
    assignmentsDialogMode: 'create' as const,
    linkForm: {},
    selectedTour: {
      id: 'tour-1',
      name: 'Schadstoffmobil',
      wasteFractionIds: [],
      recurrence: 'custom',
      customDates: [{ date: '2026-08-18' }],
      status: 'published',
      createdAt: '2026-06-14T10:00:00.000Z',
      updatedAt: '2026-06-14T10:00:00.000Z',
    },
    calendarOpen: false,
    message: null,
    lastOutcome: null,
    saving: false,
    setTourForm: vi.fn((updater: unknown) => {
      state.current.tourForm =
        typeof updater === 'function'
          ? (updater as (current: typeof state.current.tourForm) => typeof state.current.tourForm)(
              state.current.tourForm
            )
          : (updater as typeof state.current.tourForm);
    }),
  },
}));

vi.mock('../src/use-waste-tours-state.js', () => ({
  useWasteToursState: () => state.current,
}));

vi.mock('../src/use-waste-tours-overview.js', () => ({
  useWasteToursOverview: () => loadOverviewMock,
}));

vi.mock('../src/waste-management.tours.actions.js', () => ({
  createWasteToursActions: () => ({}),
}));

vi.mock('../src/waste-management.tours-mutations.js', () => ({
  createWasteToursMutationHandlers: () => ({}),
}));

vi.mock('../src/waste-management.tours.locations.js', () => ({
  resolveTourLocationOptions: () => [],
  resolveTourAssignmentLocationOptions: () => [],
}));

vi.mock('../src/waste-management.tours.shared.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.tours.shared.js')>(
    '../src/waste-management.tours.shared.js'
  );

  return {
    ...actual,
    filterTours: (tours: unknown) => tours,
  };
});

const search: WasteManagementSearchParams = {
  tab: 'tours',
  masterDataTab: 'fractions',
  fractionsView: 'list',
  toursView: 'edit',
  locationsView: 'list',
  schedulingView: 'list',
  q: '',
  page: 1,
  pageSize: 25,
  status: 'all',
  tourValidityPeriod: 'all',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
  tourId: 'tour-1',
};

describe('useWasteToursViewModel', () => {
  beforeEach(() => {
    loadOverviewMock.mockReset();
    state.current.schedulingOverview = null;
    state.current.tourForm = {
      id: 'tour-1',
      dateLocationAssignments: [],
    };
    state.current.setTourForm.mockClear();
  });

  it('hydrates date location assignments for edit routes even without an open dialog', () => {
    const { rerender } = renderHook(() => useWasteToursViewModel((key) => key, search));

    expect(state.current.setTourForm).not.toHaveBeenCalled();

    state.current.schedulingOverview = {
      locationTourPickupDates: [
        {
          id: 'pickup-1',
          pickupDate: '2026-08-18',
          locationId: 'location-1',
          tourId: 'tour-1',
          note: '08:00: Markt',
          createdAt: '2026-06-14T10:00:00.000Z',
          updatedAt: '2026-06-14T10:00:00.000Z',
        },
      ],
      holidayRules: [],
      globalDateShifts: [],
      tourDateShifts: [],
    };

    rerender();

    expect(state.current.setTourForm).toHaveBeenCalledTimes(1);
    expect(state.current.tourForm.dateLocationAssignments).toEqual([
      {
        id: 'pickup-1',
        pickupDate: '2026-08-18',
        locationId: 'location-1',
        note: '08:00: Markt',
      },
    ]);
  });
});

vi.mock('../src/waste-management.api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/waste-management.api.js')>()),
  getWasteManagementSchedulingOverview: vi.fn(),
  getWasteManagementToursOverview: vi.fn(),
  getWasteManagementMasterDataOverview: vi.fn(),
}));

describe('tour scheduling load state', () => {
  it('reports success and failure and ignores a response from an obsolete context', async () => {
    const { getWasteManagementSchedulingOverview } = await import('../src/waste-management.api.js');
    const { loadWasteToursSchedulingOverview } =
      await import('../src/waste-management.tours-overview.parts.js');
    const setSchedulingOverview = vi.fn();
    const setSchedulingLoadState = vi.fn();
    const options = { isMounted: () => true, setSchedulingOverview, setSchedulingLoadState };
    vi.mocked(getWasteManagementSchedulingOverview).mockResolvedValue({
      holidayRules: [],
      tourDateShifts: [],
      globalDateShifts: [],
    } as never);
    await loadWasteToursSchedulingOverview(options);
    expect(setSchedulingLoadState).toHaveBeenLastCalledWith('ready');
    vi.mocked(getWasteManagementSchedulingOverview).mockRejectedValue(new Error('offline'));
    await loadWasteToursSchedulingOverview(options);
    expect(setSchedulingOverview).toHaveBeenLastCalledWith(null);
    expect(setSchedulingLoadState).toHaveBeenLastCalledWith('error');
    setSchedulingLoadState.mockClear();
    await loadWasteToursSchedulingOverview({ ...options, isMounted: () => false });
    expect(setSchedulingLoadState).not.toHaveBeenCalled();
  });

  it('clears prior scheduling and prevents an older reload from overwriting current state', async () => {
    const api = await import('../src/waste-management.api.js');
    const { useWasteToursOverview } = await vi.importActual<
      typeof import('../src/use-waste-tours-overview.js')
    >('../src/use-waste-tours-overview.js');
    const { useWasteToursState } = await vi.importActual<
      typeof import('../src/use-waste-tours-state.js')
    >('../src/use-waste-tours-state.js');
    const pending: ((
      value: Awaited<ReturnType<typeof api.getWasteManagementSchedulingOverview>>
    ) => void)[] = [];
    vi.mocked(api.getWasteManagementSchedulingOverview).mockImplementation(
      () => new Promise((resolve) => pending.push(resolve))
    );
    vi.mocked(api.getWasteManagementToursOverview).mockResolvedValue({ tours: [] } as never);
    vi.mocked(api.getWasteManagementMasterDataOverview).mockResolvedValue({
      fractions: [],
      locations: [],
    } as never);
    const { result, unmount } = renderHook(() => {
      const state = useWasteToursState();
      const reload = useWasteToursOverview(state, (key) => key);
      return { state, reload };
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => {
      await result.current.reload();
    });
    expect(pending).toHaveLength(2);
    expect(result.current.state.schedulingLoadState).toBe('loading');
    const current = { holidayRules: [], tourDateShifts: [], globalDateShifts: [] };
    await act(async () => {
      pending[1]?.(current as never);
    });
    expect(result.current.state.schedulingLoadState).toBe('ready');
    await act(async () => {
      pending[0]?.({ ...current, stale: true } as never);
    });
    expect(result.current.state.schedulingOverview).toEqual(current);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.state.schedulingOverview).toBeNull();
    expect(result.current.state.schedulingLoadState).toBe('loading');
    const { createWasteToursActions } = await vi.importActual<
      typeof import('../src/waste-management.tours.actions.js')
    >('../src/waste-management.tours.actions.js');
    let calendarRequest: Promise<void> | undefined;
    act(() => {
      calendarRequest = createWasteToursActions(result.current.state).openCalendar({
        id: 'other-tour',
      } as never);
    });
    expect(result.current.state.calendarOpen).toBe(true);
    await act(async () => {
      pending[3]?.(current as never);
      await calendarRequest;
    });
    await act(async () => {
      pending[2]?.({ ...current, stale: true } as never);
    });
    expect(result.current.state.schedulingOverview).toEqual(current);
    expect(result.current.state.schedulingLoadState).toBe('ready');
    unmount();
  });
});
