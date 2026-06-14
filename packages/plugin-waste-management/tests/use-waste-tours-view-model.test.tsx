import { renderHook } from '@testing-library/react';
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
      active: true,
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
          ? (updater as (current: typeof state.current.tourForm) => typeof state.current.tourForm)(state.current.tourForm)
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
