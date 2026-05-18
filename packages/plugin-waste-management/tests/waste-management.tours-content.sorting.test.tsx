import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToursContent } from '../src/waste-management.tours.content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
}));

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

vi.mock('../src/waste-management.tours.presentation.js', () => ({
  formatTourRecurrence: (_pt: unknown, recurrence: string | undefined) => `recurrence:${recurrence ?? 'none'}`,
}));

vi.mock('../src/waste-management.tours.empty-state.js', () => ({
  WasteToursEmptyState: () => <div>empty</div>,
}));

vi.mock('../src/waste-management.tours.content.parts.js', () => ({
  useWasteToursSelectionState: () => {
    const [tourPendingDelete, setTourPendingDelete] = React.useState<{ id: string; name: string } | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [selectedTourIds, setSelectedTourIds] = React.useState<string[]>(['tour-1', 'tour-2']);
    return {
      selectedTourIds,
      setSelectedTourIds,
      filtersOpen: false,
      setFiltersOpen: vi.fn(),
      tourPendingDelete,
      setTourPendingDelete,
      bulkDeleteOpen,
      setBulkDeleteOpen,
      allVisibleSelected: false,
      someVisibleSelected: true,
      toggleSelectAllVisible: vi.fn(),
      toggleSelectedTour: vi.fn(),
    };
  },
  WasteToursDeleteDialogs: ({
    tourPendingDelete,
    bulkDeleteOpen,
    selectedTourIds,
    onDeleteTour,
    onDeleteTours,
    onAfterBulkDelete,
    onCancelSingle,
  }: {
    readonly tourPendingDelete: { id: string; name: string } | null;
    readonly bulkDeleteOpen: boolean;
    readonly selectedTourIds: string[];
    readonly onDeleteTour: (tour: { id: string; name: string }) => Promise<void>;
    readonly onDeleteTours: (ids: readonly string[]) => Promise<void>;
    readonly onAfterBulkDelete: () => void;
    readonly onCancelSingle: () => void;
  }) => (
    <div>
      {tourPendingDelete ? (
        <button
          onClick={() => {
            void onDeleteTour(tourPendingDelete);
            onCancelSingle();
          }}
        >
          confirm-single-delete
        </button>
      ) : null}
      {bulkDeleteOpen ? (
        <button
          onClick={() => {
            void onDeleteTours(selectedTourIds);
            onAfterBulkDelete();
          }}
        >
          confirm-bulk-delete
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('../src/waste-management.tours.content.body.js', () => ({
  WasteToursContentBody: ({
    tours,
    onSortChange,
    setTourPendingDelete,
    setBulkDeleteOpen,
  }: {
    readonly tours: Array<{ id: string; name: string }>;
    readonly onSortChange: (field: 'locations') => void;
    readonly setTourPendingDelete: (tour: { id: string; name: string }) => void;
    readonly setBulkDeleteOpen: (open: boolean) => void;
  }) => (
    <div>
      <button onClick={() => onSortChange('locations')}>sort-locations</button>
      <button onClick={() => onSortChange('locations')}>sort-locations-again</button>
      <button onClick={() => setTourPendingDelete(tours[0]!)}>open-single-delete</button>
      <button onClick={() => setBulkDeleteOpen(true)}>open-bulk-delete</button>
      <div data-testid="tour-order">{tours.map((tour) => tour.id).join(',')}</div>
    </div>
  ),
}));

describe('WasteToursContent sorting and delete flows', () => {
  afterEach(() => {
    cleanup();
  });

  it('sorts by linked location counts and executes single plus bulk delete flows', async () => {
    const onDeleteTour = vi.fn(async () => undefined);
    const onDeleteTours = vi.fn(async () => undefined);

    render(
      <WasteToursContent
        assignmentContextLoading={false}
        message={null}
        tours={[
          { id: 'tour-1', name: 'Tour Eins', recurrence: 'weekly', active: true } as never,
          { id: 'tour-2', name: 'Tour Zwei', recurrence: 'monthly', active: false } as never,
        ]}
        fractions={[] as never}
        masterDataOverview={{
          locationTourLinks: [
            { id: 'link-1', locationId: 'location-1', tourId: 'tour-1' },
            { id: 'link-2', locationId: 'location-2', tourId: 'tour-1' },
            { id: 'link-3', locationId: 'location-3', tourId: 'tour-2' },
          ],
        } as never}
        schedulingOverview={null}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={vi.fn()}
        onOpenCreateAssignmentsDialog={vi.fn()}
        onOpenEditAssignmentsDialog={vi.fn()}
        onOpenCalendar={vi.fn()}
        onToggleTourStatus={vi.fn(async () => undefined)}
        onDeleteTour={onDeleteTour}
        onDeleteTours={onDeleteTours}
        saving={false}
        page={1}
        pageSize={25}
        query=""
        status="all"
        onPageChange={vi.fn()}
        onSyncPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('tour-order').textContent).toBe('tour-1,tour-2');
    fireEvent.click(screen.getByRole('button', { name: 'sort-locations' }));
    expect(screen.getByTestId('tour-order').textContent).toBe('tour-2,tour-1');
    fireEvent.click(screen.getByRole('button', { name: 'sort-locations-again' }));
    expect(screen.getByTestId('tour-order').textContent).toBe('tour-1,tour-2');

    fireEvent.click(screen.getByRole('button', { name: 'open-single-delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm-single-delete' }));
    expect(onDeleteTour).toHaveBeenCalledWith(expect.objectContaining({ id: 'tour-1' }));

    fireEvent.click(screen.getByRole('button', { name: 'open-bulk-delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm-bulk-delete' }));
    expect(onDeleteTours).toHaveBeenCalledWith(['tour-1', 'tour-2']);
  });
});
