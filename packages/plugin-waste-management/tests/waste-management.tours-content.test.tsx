import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveTourAssignmentItemsMock = vi.hoisted(() => vi.fn());

import { WasteToursContent } from '../src/waste-management.tours.content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('../src/waste-management.tours.presentation.js', () => ({
  formatTourDateRange: (tour: { id: string }) => `range:${tour.id}`,
  formatTourRecurrence: (_pt: unknown, recurrence: string | undefined) => `recurrence:${recurrence ?? 'none'}`,
}));

vi.mock('../src/waste-management.tours.locations.js', () => ({
  resolveTourAssignmentItems: resolveTourAssignmentItemsMock,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) => (message ? <div>{message.text}</div> : null),
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({
    children,
    variant,
  }: {
    readonly children: React.ReactNode;
    readonly variant?: string;
  }) => <span data-testid="badge" data-variant={variant ?? 'default'}>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Checkbox: ({ indeterminate, ...props }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
    void indeterminate;
    return <input type="checkbox" {...props} />;
  },
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  Dialog: ({ open, children }: { readonly open?: boolean; readonly children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioConfirmDialog: ({ open }: { readonly open: boolean }) => (open ? <div data-testid="confirm-dialog" /> : null),
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>,
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

describe('WasteToursContent', () => {
  beforeEach(() => {
    resolveTourAssignmentItemsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the tours overview as a table with row actions and assignment context', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([
      {
        id: 'link-1',
        label: 'Musterstraße 1',
        startDate: '2026-05-01',
        endDate: '2026-12-31',
      },
      {
        id: 'link-2',
        label: 'Bahnhofstraße 2',
        startDate: null,
        endDate: null,
      },
    ]);

    const onOpenEditDialog = vi.fn();
    const onOpenDuplicateDialog = vi.fn();
    const onOpenCreateAssignmentsDialog = vi.fn();
    const onOpenEditAssignmentsDialog = vi.fn();
    const onOpenCalendar = vi.fn();
    const tour = {
      id: 'tour-1',
      name: 'Restmüll Nord',
      description: 'Wöchentliche Abholung',
      recurrence: 'weekly',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      locationCount: 4,
      customDates: [
        { date: '2026-12-24', description: 'Weihnachten' },
        { date: '2026-12-31', description: '' },
      ],
      active: true,
    };

    render(
      <WasteToursContent
        assignmentContextLoading={false}
        message={{ tone: 'info', text: 'tour message' } as never}
        tours={[tour] as never}
        fractions={[
          { id: 'fraction-1', name: 'Restmüll' },
          { id: 'fraction-2', name: 'Biomüll' },
        ] as never}
        masterDataOverview={{} as never}
        schedulingOverview={null}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={onOpenEditDialog}
        onOpenDuplicateDialog={onOpenDuplicateDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        onOpenCalendar={onOpenCalendar}
        onToggleTourStatus={vi.fn(async () => undefined)}
        onDeleteTour={vi.fn(async () => undefined)}
        onDeleteTours={vi.fn(async () => undefined)}
        canDuplicateTour
        saving={false}
        page={1}
        pageSize={25}
        query=""
        status="all"
        tourWasteFractionId={undefined}
        firstDateFrom={undefined}
        firstDateTo={undefined}
        endDateFrom={undefined}
        endDateTo={undefined}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText('tour message')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'tours.table.caption' })).toBeTruthy();
    const filterButtonCard = screen.getByRole('button', { name: 'tours.filters.open' }).closest('section.bg-card');
    const toursTableCard = screen.getByRole('table', { name: 'tours.table.caption' }).closest('section.bg-card');
    expect(filterButtonCard).toBeTruthy();
    expect(filterButtonCard).toBe(toursTableCard);
    expect(screen.getByRole('columnheader', { name: 'tours.table.name none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.status none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.recurrence none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.locations none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.actions' })).toBeTruthy();
    expect(screen.getByText('Restmüll Nord')).toBeTruthy();
    expect(screen.getByText('Wöchentliche Abholung')).toBeTruthy();
    expect(screen.getByText('recurrence:weekly')).toBeTruthy();
    expect(screen.getByText('Restmüll')).toBeTruthy();
    expect(screen.getByText('Biomüll')).toBeTruthy();
    expect(screen.getByText('tours.table.noShifts')).toBeTruthy();
    expect(screen.getByTestId('tour-assignment-count-tour-1').textContent).toBe('2');
    expect(screen.queryByText('tours.meta.count:1')).toBeNull();
    expect(screen.getAllByTestId('badge')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.duplicate' }));
    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.openAssignments' }));
    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.openCalendar' }));

    expect(onOpenEditDialog).toHaveBeenCalledWith(tour);
    expect(onOpenDuplicateDialog).toHaveBeenCalledWith(tour);
    expect(onOpenCalendar).toHaveBeenCalledWith(tour);
    expect(onOpenEditAssignmentsDialog).toHaveBeenCalledWith(tour, 'link-1');
    expect(onOpenCreateAssignmentsDialog).not.toHaveBeenCalled();
  });

  it('renders a loading hint while the assignment context is still loading', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([]);

    render(
      <WasteToursContent
        assignmentContextLoading
        message={null}
        tours={[
          {
            id: 'tour-1',
            name: 'Restmüll Nord',
            recurrence: 'weekly',
            wasteFractionIds: [],
            locationCount: 0,
            customDates: [],
            active: true,
          },
        ] as never}
        fractions={[{ id: 'fraction-1', name: 'Papier' }] as never}
        masterDataOverview={null}
        schedulingOverview={null}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={vi.fn()}
        onOpenDuplicateDialog={vi.fn()}
        onOpenCreateAssignmentsDialog={vi.fn()}
        onOpenEditAssignmentsDialog={vi.fn()}
        onOpenCalendar={vi.fn()}
        onToggleTourStatus={vi.fn(async () => undefined)}
        onDeleteTour={vi.fn(async () => undefined)}
        onDeleteTours={vi.fn(async () => undefined)}
        canDuplicateTour={false}
        saving={false}
        page={1}
        pageSize={25}
        query=""
        status="all"
        tourWasteFractionId={undefined}
        firstDateFrom={undefined}
        firstDateTo={undefined}
        endDateFrom={undefined}
        endDateTo={undefined}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText('tours.table.loadingAssignments')).toBeTruthy();
  });

  it('keeps tour filter edits local until the modal applies them', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([]);

    const onFiltersChange = vi.fn();

    render(
      <WasteToursContent
        assignmentContextLoading={false}
        message={null}
        tours={[
          {
            id: 'tour-1',
            name: 'Restmüll Nord',
            recurrence: 'weekly',
            wasteFractionIds: [],
            locationCount: 0,
            customDates: [],
            active: true,
          },
        ] as never}
        fractions={[{ id: 'fraction-1', name: 'Papier' }, { id: 'fraction-2', name: 'Bio' }] as never}
        masterDataOverview={null}
        schedulingOverview={null}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={vi.fn()}
        onOpenDuplicateDialog={vi.fn()}
        onOpenCreateAssignmentsDialog={vi.fn()}
        onOpenEditAssignmentsDialog={vi.fn()}
        onOpenCalendar={vi.fn()}
        onToggleTourStatus={vi.fn(async () => undefined)}
        onDeleteTour={vi.fn(async () => undefined)}
        onDeleteTours={vi.fn(async () => undefined)}
        canDuplicateTour={false}
        saving={false}
        page={1}
        pageSize={25}
        query=""
        status="all"
        tourWasteFractionId={undefined}
        firstDateFrom={undefined}
        firstDateTo={undefined}
        endDateFrom={undefined}
        endDateTo={undefined}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onFiltersChange={onFiltersChange}
      />
    );

    expect(screen.queryByText('tours.filters.title')).toBeNull();
    expect(screen.queryByRole('button', { name: 'tours.table.filtersTitle' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'tours.filters.open' }));
    expect(screen.getByText('tours.filters.title')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('tours.filters.nameLabel'), {
      target: { value: 'Papier' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.statusLabel'), {
      target: { value: 'inactive' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.fractionLabel'), {
      target: { value: 'fraction-1' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.firstDateFromLabel'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.endDateToLabel'), {
      target: { value: '2026-10-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tours.filters.cancel' }));

    expect(onFiltersChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'tours.filters.open' }));
    fireEvent.change(screen.getByLabelText('tours.filters.nameLabel'), {
      target: { value: 'Papier' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.statusLabel'), {
      target: { value: 'inactive' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.fractionLabel'), {
      target: { value: 'fraction-1' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.firstDateFromLabel'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('tours.filters.endDateToLabel'), {
      target: { value: '2026-10-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tours.filters.apply' }));

    expect(onFiltersChange).toHaveBeenCalledWith(
      'Papier',
      'inactive',
      'fraction-1',
      '2026-02-01',
      undefined,
      undefined,
      '2026-10-31'
    );
  });

  it('shows a direct reset action for active tour filters', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([]);

    const onFiltersChange = vi.fn();

    render(
      <WasteToursContent
        assignmentContextLoading={false}
        message={null}
        tours={[
          {
            id: 'tour-1',
            name: 'Restmüll Nord',
            recurrence: 'weekly',
            wasteFractionIds: [],
            locationCount: 0,
            customDates: [],
            active: true,
          },
        ] as never}
        fractions={[] as never}
        masterDataOverview={null}
        schedulingOverview={null}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={vi.fn()}
        onOpenDuplicateDialog={vi.fn()}
        onOpenCreateAssignmentsDialog={vi.fn()}
        onOpenEditAssignmentsDialog={vi.fn()}
        onOpenCalendar={vi.fn()}
        onToggleTourStatus={vi.fn(async () => undefined)}
        onDeleteTour={vi.fn(async () => undefined)}
        onDeleteTours={vi.fn(async () => undefined)}
        canDuplicateTour={false}
        saving={false}
        page={1}
        pageSize={25}
        query="Bio"
        status="active"
        tourWasteFractionId={'fraction-2'}
        firstDateFrom={'2026-01-01'}
        firstDateTo={undefined}
        endDateFrom={undefined}
        endDateTo={undefined}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onFiltersChange={onFiltersChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'tours.filters.reset' }));
    expect(onFiltersChange).toHaveBeenCalledWith('', 'all', undefined, undefined, undefined, undefined, undefined);
  });
});
