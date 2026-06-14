import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteToursListView } from '../src/waste-management.tours-list-view.js';
import type { WasteManagementSearchParams } from '../src/search-params.js';
import type { useWasteToursViewModel } from '../src/use-waste-tours-view-model.js';

const navigateMock = vi.fn();
type WasteViewModel = ReturnType<typeof useWasteToursViewModel>;

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../src/waste-management.tours.content.js', () => ({
  WasteToursContent: ({
    onOpenCreateDialog,
    onOpenEditDialog,
  }: {
    readonly onOpenCreateDialog: () => void;
    readonly onOpenEditDialog: (tour: { id: string; name: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={onOpenCreateDialog}>
        open-create
      </button>
      <button type="button" onClick={() => onOpenEditDialog({ id: 'tour-1', name: 'Tour 1' })}>
        open-edit
      </button>
    </div>
  ),
  WasteToursEmptyState: ({ onOpenCreateDialog }: { readonly onOpenCreateDialog: () => void }) => (
    <button type="button" onClick={onOpenCreateDialog}>
      empty-create
    </button>
  ),
}));

vi.mock('../src/waste-management.tours.shared.js', () => ({
  createDefaultTourForm: () => ({ id: 'new-tour', name: '' }),
  mapTourWithPickupDatesToForm: (tour: { id: string; name: string }) => ({ id: tour.id, name: tour.name }),
}));

const createSearch = (): WasteManagementSearchParams => ({
  tab: 'tours',
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
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
  tourDateShiftId: undefined,
  globalDateShiftId: undefined,
});

const createController = (
  overrides: Partial<WasteViewModel> = {}
): WasteViewModel =>
  ({
    tours: [],
    overview: null,
    assignmentContextLoading: false,
    message: null,
    availableFractions: [],
    masterDataOverview: null,
    schedulingOverview: null,
    openCreateAssignmentsDialog: vi.fn(),
    openEditAssignmentsDialog: vi.fn(),
    openCalendar: vi.fn(),
    onToggleTourStatus: vi.fn(),
    onDeleteTour: vi.fn(),
    onDeleteTours: vi.fn(),
    saving: false,
    setDialogMode: vi.fn(),
    setDialogOpen: vi.fn(),
    setTourForm: vi.fn(),
    setSelectedTour: vi.fn(),
    setMessage: vi.fn(),
    setLastOutcome: vi.fn(),
    ...overrides,
  }) as WasteViewModel;

describe('WasteToursListView', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('clears stale success state before opening the create form', () => {
    const controller = createController();

    render(<WasteToursListView controller={controller} search={createSearch()} />);

    fireEvent.click(screen.getByRole('button', { name: 'empty-create' }));

    expect(controller.setDialogMode).toHaveBeenCalledWith('create');
    expect(controller.setSelectedTour).toHaveBeenCalledWith(null);
    expect(controller.setTourForm).toHaveBeenCalledWith({ id: 'new-tour', name: '' });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ toursView: 'create', tourId: undefined }),
    });
  });

  it('clears stale success state before opening the edit form', () => {
    const controller = createController({
      tours: [{ id: 'tour-1', name: 'Tour 1' }],
    });

    render(<WasteToursListView controller={controller} search={createSearch()} />);

    fireEvent.click(screen.getByRole('button', { name: 'open-edit' }));

    expect(controller.setDialogMode).toHaveBeenCalledWith('edit');
    expect(controller.setSelectedTour).toHaveBeenCalledWith({ id: 'tour-1', name: 'Tour 1' });
    expect(controller.setTourForm).toHaveBeenCalledWith({ id: 'tour-1', name: 'Tour 1' });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ toursView: 'edit', tourId: 'tour-1' }),
    });
  });

  it('keeps the tours list view visible when filters hide all tours but overview data still exists', () => {
    const controller = createController({
      tours: [],
      overview: {
        tours: [{ id: 'tour-1', name: 'Tour 1' }],
      },
    });

    render(<WasteToursListView controller={controller} search={createSearch()} />);

    expect(screen.getByRole('button', { name: 'open-create' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'empty-create' })).toBeNull();
  });
});
