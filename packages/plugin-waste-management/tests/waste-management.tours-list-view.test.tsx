import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteToursListView } from '../src/waste-management.tours-list-view.js';

const navigateMock = vi.fn();

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
  mapTourToForm: (tour: { id: string; name: string }) => ({ id: tour.id, name: tour.name }),
}));

describe('WasteToursListView', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('clears stale success state before opening the create form', () => {
    const controller = {
      tours: [],
      setDialogMode: vi.fn(),
      setDialogOpen: vi.fn(),
      setTourForm: vi.fn(),
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;

    render(
      <WasteToursListView
        controller={controller}
        search={{
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
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'empty-create' }));

    expect(controller.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ toursView: 'create' }),
    });
  });

  it('clears stale success state before opening the edit form', () => {
    const controller = {
      tours: [{ id: 'tour-1', name: 'Tour 1' }],
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
      setMessage: vi.fn(),
      setLastOutcome: vi.fn(),
    } as never;

    render(
      <WasteToursListView
        controller={controller}
        search={{
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
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-edit' }));

    expect(controller.setLastOutcome).toHaveBeenCalledWith(null);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/plugins/waste-management',
      search: expect.objectContaining({ toursView: 'edit' }),
    });
  });
});
