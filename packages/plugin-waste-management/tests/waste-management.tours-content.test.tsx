import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveTourAssignmentItemsMock = vi.hoisted(() => vi.fn());

import { WasteToursContent } from '../src/waste-management.tours.content.js';
import { WasteToursDeleteDialogs } from '../src/waste-management.tours-delete-dialogs.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('../src/waste-management.tours.presentation.js', () => ({
  resolveTourShiftDetails: (
    _tour: unknown,
    schedulingOverview: { holidayRules?: unknown[] } | null
  ) =>
    schedulingOverview?.holidayRules?.length
      ? [
          {
            id: 'tour-shift-1',
            source: 'tour',
            originalDate: '2025-12-24',
            actualDate: '2025-12-23',
            reasonType: 'weather',
            reasonKey: 'snow',
            description: 'Schneefall',
          },
          {
            id: 'global-shift-1',
            source: 'global',
            originalDate: '2025-12-31',
            actualDate: '2025-12-30',
            reasonType: undefined,
            reasonKey: undefined,
            description: 'Betriebsversammlung',
          },
          {
            id: 'holiday:2026-01-01:2026-01-02',
            source: 'holiday',
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            holidayNames: ['Neujahrstag'],
          },
          {
            id: 'holiday:2026-01-02:2026-01-03',
            source: 'holiday',
            originalDate: '2026-01-02',
            actualDate: '2026-01-03',
            holidayNames: ['Neujahrstag'],
          },
        ]
      : [],
  formatTourDateRange: (tour: { id: string }) => `range:${tour.id}`,
  formatTourRecurrence: (_pt: unknown, recurrence: string | undefined) =>
    `recurrence:${recurrence ?? 'none'}`,
}));

vi.mock('../src/waste-management.tours.locations.js', () => ({
  resolveTourAssignmentItems: resolveTourAssignmentItemsMock,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  StatusNotice: ({ message }: { readonly message: { text: string } | null }) =>
    message ? <div>{message.text}</div> : null,
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioDestructiveActionDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    pending,
    confirmDisabled,
    errorMessage,
    children,
  }: {
    readonly open: boolean;
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly confirmLabel: React.ReactNode;
    readonly cancelLabel: React.ReactNode;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
    readonly pending?: boolean;
    readonly confirmDisabled?: boolean;
    readonly errorMessage?: React.ReactNode;
    readonly children?: React.ReactNode;
  }) =>
    open ? (
      <div role="alertdialog">
        <div>{title}</div>
        <div>{description}</div>
        {children}
        {errorMessage ? <div role="alert">{errorMessage}</div> : null}
        <button type="button" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" disabled={pending || confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
  Badge: ({
    children,
    variant,
  }: {
    readonly children: React.ReactNode;
    readonly variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant ?? 'default'}>
      {children}
    </span>
  ),
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioTableValueAction: ({
    asChild,
    children,
    emphasis,
    numeric,
    ...props
  }: React.ComponentProps<'button'> & {
    readonly asChild?: boolean;
    readonly emphasis?: string;
    readonly numeric?: boolean;
  }) => {
    void emphasis;
    void numeric;
    return asChild && React.isValidElement(children) ? (
      React.cloneElement(children as React.ReactElement<Record<string, unknown>>, props)
    ) : (
      <button {...props}>{children}</button>
    );
  },
  StudioTableActionButton: ({
    label,
    icon,
    tone,
    ...props
  }: React.ComponentProps<'button'> & {
    readonly label: string;
    readonly icon: React.ReactNode;
    readonly tone?: string;
  }) => {
    void tone;
    return (
      <button aria-label={label} {...props}>
        {icon}
      </button>
    );
  },
  StudioStatusBadge: ({
    children,
    editable,
    tone,
  }: {
    readonly children: React.ReactNode;
    readonly editable?: boolean;
    readonly tone?: string;
  }) => {
    void editable;
    void tone;
    return <span data-testid="status-badge">{children}</span>;
  },
  Checkbox: ({
    indeterminate,
    ...props
  }: React.ComponentProps<'input'> & { readonly indeterminate?: boolean }) => {
    void indeterminate;
    return <input type="checkbox" {...props} />;
  },
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  Dialog: ({ open, children }: { readonly open?: boolean; readonly children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    children,
    confirmDisabled,
    cancelDisabled,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
    readonly children?: React.ReactNode;
    readonly confirmDisabled?: boolean;
    readonly cancelDisabled?: boolean;
  }) =>
    open ? (
      <div>
        <p>{title}</p>
        <p>{description}</p>
        {children}
        <button type="button" disabled={confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" disabled={cancelDisabled} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    ) : null,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => (
    <div data-testid="empty-state">{children}</div>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('../src/waste-management.tab-panel-actions.js', () => ({
  useWasteTabPanelActions: vi.fn(),
}));

vi.mock('../src/waste-management.tour-shift-create-link.js', () => ({
  WasteTourShiftCreateLink: ({
    label,
    accessibleLabel,
  }: {
    readonly label: string;
    readonly accessibleLabel?: string;
  }) => (
    <a
      href="/plugins/waste-management"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={accessibleLabel ?? label}
    >
      {label}
    </a>
  ),
}));

const toursSearch = {
  tab: 'tours' as const,
  masterDataTab: 'locations' as const,
  fractionsView: 'list' as const,
  toursView: 'list' as const,
  locationsView: 'list' as const,
  schedulingView: 'list' as const,
  q: '',
  page: 1,
  pageSize: 25,
  status: 'all' as const,
  tourValidityPeriod: 'all' as const,
  shiftContext: 'all' as const,
  fractionsSortBy: 'name' as const,
  fractionsSortDirection: 'asc' as const,
};

describe('WasteToursContent', () => {
  it('restores focus to the tours region after deleting a row', async () => {
    const tour = { id: 'tour-1', name: 'Tour 1' } as never;
    const Harness = () => {
      const [rowVisible, setRowVisible] = React.useState(true);
      const [pendingTour, setPendingTour] = React.useState<typeof tour | null>(null);
      const fallbackFocusRef = React.useRef<HTMLElement | null>(null);
      return (
        <section ref={fallbackFocusRef} tabIndex={-1} aria-label="Touren">
          {rowVisible ? (
            <button type="button" onClick={() => setPendingTour(tour)}>
              Tour löschen
            </button>
          ) : null}
          <WasteToursDeleteDialogs
            tourPendingDelete={pendingTour}
            tourPendingStatusChange={null}
            bulkDeleteOpen={false}
            selectedTourIds={[]}
            onCancelSingle={() => setPendingTour(null)}
            onCancelStatusChange={vi.fn()}
            onCancelBulk={vi.fn()}
            onConfirmStatusChange={vi.fn(async () => undefined)}
            statusChangePending={false}
            statusChangeError={null}
            onDeleteTour={async () => {
              setRowVisible(false);
              await new Promise((resolve) => window.setTimeout(resolve, 0));
            }}
            onDeleteTours={vi.fn(async () => ({ failedIds: [] }))}
            onAfterBulkDelete={vi.fn()}
            fallbackFocusRef={fallbackFocusRef}
          />
        </section>
      );
    };

    render(<Harness />);
    const deleteButton = screen.getByRole('button', { name: 'Tour löschen' });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'tours.deleteDialog.confirm' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Touren' }));
    });
  });

  it('keeps failed tour ids in the open bulk-delete dialog for retry', async () => {
    const onDeleteTours = vi
      .fn()
      .mockResolvedValueOnce({ failedIds: ['tour-2'] })
      .mockResolvedValueOnce({ failedIds: [] });

    const Harness = () => {
      const [selectedTourIds, setSelectedTourIds] = React.useState(['tour-1', 'tour-2']);
      const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(true);
      return (
        <WasteToursDeleteDialogs
          tourPendingDelete={null}
          tourPendingStatusChange={null}
          bulkDeleteOpen={bulkDeleteOpen}
          selectedTourIds={selectedTourIds}
          onCancelSingle={vi.fn()}
          onCancelStatusChange={vi.fn()}
          onCancelBulk={() => setBulkDeleteOpen(false)}
          onConfirmStatusChange={vi.fn(async () => undefined)}
          statusChangePending={false}
          statusChangeError={null}
          onDeleteTour={vi.fn(async () => undefined)}
          onDeleteTours={onDeleteTours}
          onAfterBulkDelete={(failedIds) => {
            setSelectedTourIds([...failedIds]);
            if (failedIds.length === 0) setBulkDeleteOpen(false);
          }}
        />
      );
    };

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'tours.bulkDeleteDialog.confirm' }));

    await waitFor(() => {
      expect(onDeleteTours).toHaveBeenLastCalledWith(['tour-1', 'tour-2']);
      expect(screen.getByRole('alert').textContent).toBe('tours.messages.deleteError');
      expect(screen.getByText('tours.bulkDeleteDialog.description:1')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'tours.bulkDeleteDialog.confirm' }));

    await waitFor(() => {
      expect(onDeleteTours).toHaveBeenLastCalledWith(['tour-2']);
      expect(screen.queryByText('tours.bulkDeleteDialog.title')).toBeNull();
    });
  });

  beforeEach(() => {
    resolveTourAssignmentItemsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the tours overview as a table with row actions and assignment context', async () => {
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
    const onOpenEditFraction = vi.fn();
    const onToggleTourStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
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
        fractions={
          [
            { id: 'fraction-1', name: 'Restmüll' },
            { id: 'fraction-2', name: 'Biomüll' },
          ] as never
        }
        masterDataOverview={{} as never}
        schedulingOverview={null}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={onOpenEditDialog}
        onOpenDuplicateDialog={onOpenDuplicateDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        onOpenCalendar={onOpenCalendar}
        onOpenEditFraction={onOpenEditFraction}
        onToggleTourStatus={onToggleTourStatus}
        onDeleteTour={vi.fn(async () => undefined)}
        onDeleteTours={vi.fn(async () => undefined)}
        canDuplicateTour
        canManageScheduling
        search={toursSearch}
        saving={false}
        page={1}
        pageSize={25}
        query=""
        status="all"
        tourValidityPeriod="all"
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
    const filterButtonCard = screen
      .getByRole('button', { name: 'tours.filters.open' })
      .closest('section.bg-card');
    const toursTableCard = screen
      .getByRole('table', { name: 'tours.table.caption' })
      .closest('section.bg-card');
    expect(filterButtonCard).toBeTruthy();
    expect(filterButtonCard).toBe(toursTableCard);
    expect(screen.getByRole('columnheader', { name: 'tours.table.name none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.status none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.recurrence none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.locations none' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.actions' })).toBeTruthy();
    expect(screen.getByText('Restmüll Nord')).toBeTruthy();
    expect(screen.queryByText('Wöchentliche Abholung')).toBeNull();
    expect(screen.getByText('recurrence:weekly')).toBeTruthy();
    expect(screen.getByText('Restmüll')).toBeTruthy();
    expect(screen.getByText('Biomüll')).toBeTruthy();
    expect(screen.getByText('tours.actions.createShiftShort')).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: 'tours.actions.createShiftAccessible:Restmüll Nord',
      })
    ).toBeTruthy();
    expect(screen.getByTestId('tour-assignment-count-tour-1').textContent).toBe('2');
    expect(screen.queryByText('tours.meta.count:1')).toBeNull();
    expect(screen.getByTestId('status-badge')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Restmüll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restmüll Nord' }));
    expect(screen.queryByRole('button', { name: 'tours.actions.edit' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.duplicate' }));
    expect(screen.queryByRole('button', { name: 'tours.actions.openAssignments' })).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'tours.actions.openAssignmentsAccessible:Restmüll Nord|2',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.openCalendar' }));
    const statusButton = screen.getByRole('button', {
      name: 'tours.actions.deactivateStatus:Restmüll Nord',
    });
    expect(statusButton.className).toContain('min-h-11');
    expect(statusButton.className).toContain('min-w-11');
    fireEvent.click(statusButton);

    expect(onOpenEditDialog).toHaveBeenCalledWith(tour);
    expect(onOpenDuplicateDialog).toHaveBeenCalledWith(tour);
    expect(onOpenCalendar).toHaveBeenCalledWith(tour);
    expect(onOpenEditFraction).toHaveBeenCalledWith('fraction-1');
    expect(onOpenEditAssignmentsDialog).toHaveBeenCalledWith(tour, 'link-1');
    expect(onOpenCreateAssignmentsDialog).not.toHaveBeenCalled();
    expect(screen.getByText('tours.statusDialog.deactivateTitle')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.statusDialog.confirm' }));
    expect(onToggleTourStatus).toHaveBeenCalledWith(tour, false);
    expect((await screen.findByRole('alert')).textContent).toContain('tours.statusDialog.error');
    expect(screen.getByText('tours.statusDialog.deactivateTitle')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.statusDialog.confirm' }));
    await waitFor(() =>
      expect(screen.queryByText('tours.statusDialog.deactivateTitle')).toBeNull()
    );
    expect(onToggleTourStatus).toHaveBeenCalledTimes(2);
  });

  it('renders a loading hint while the assignment context is still loading', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([]);

    render(
      <WasteToursContent
        assignmentContextLoading
        message={null}
        tours={
          [
            {
              id: 'tour-1',
              name: 'Restmüll Nord',
              recurrence: 'weekly',
              wasteFractionIds: [],
              locationCount: 0,
              customDates: [],
              active: true,
            },
          ] as never
        }
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
        canManageScheduling
        search={toursSearch}
        saving={false}
        page={1}
        pageSize={25}
        query=""
        status="all"
        tourValidityPeriod="all"
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

  it('opens zero assignments and the exact holiday-rule based shifts from their columns', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([]);
    const onOpenCreateAssignmentsDialog = vi.fn();

    render(
      <WasteToursContent
        assignmentContextLoading={false}
        message={null}
        tours={
          [
            {
              id: 'tour-1',
              name: 'Restmüll Nord',
              recurrence: 'weekly',
              wasteFractionIds: [],
              locationCount: 0,
              customDates: [],
              active: true,
            },
          ] as never
        }
        fractions={[{ id: 'fraction-1', name: 'Papier' }] as never}
        masterDataOverview={null}
        schedulingOverview={
          { holidayRules: [{ id: 'holiday-1' }], globalDateShifts: [], tourDateShifts: [] } as never
        }
        canManageScheduling
        search={toursSearch}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={vi.fn()}
        onOpenDuplicateDialog={vi.fn()}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
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
        tourValidityPeriod="all"
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

    fireEvent.click(
      screen.getByRole('button', {
        name: 'tours.actions.openAssignmentsAccessible:Restmüll Nord|0',
      })
    );
    expect(onOpenCreateAssignmentsDialog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tour-1' })
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'tours.shiftDetails.open:4|Restmüll Nord',
      })
    );

    expect(screen.getByText('tours.shiftDetails.title:Restmüll Nord')).toBeTruthy();
    expect(screen.getByText('tours.shiftDetails.sources.tour')).toBeTruthy();
    expect(screen.getByText('tours.shiftDetails.sources.global')).toBeTruthy();
    expect(screen.getAllByText('tours.shiftDetails.sources.holiday')).toHaveLength(2);
    expect(screen.getByText('Schneefall')).toBeTruthy();
    expect(screen.getByText('scheduling.reasonTypes.weather')).toBeTruthy();
    expect(screen.getByText('tours.shiftDetails.reasonKey:snow')).toBeTruthy();
    expect(screen.getByText('Betriebsversammlung')).toBeTruthy();
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeZone: 'UTC',
    });
    expect(
      screen.getByText(
        `tours.shiftDetails.dateChange:${dateFormatter.format(new Date('2026-01-01T00:00:00Z'))}|${dateFormatter.format(new Date('2026-01-02T00:00:00Z'))}`
      )
    ).toBeTruthy();
    expect(screen.getAllByText('tours.shiftDetails.holidays:Neujahrstag')).toHaveLength(2);
    expect(screen.getByText('tours.actions.createAnotherShift')).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: 'tours.actions.createShiftAccessible:Restmüll Nord',
      })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.shiftDetails.close' }));
    expect(screen.queryByText('tours.shiftDetails.title:Restmüll Nord')).toBeNull();
  });

  it('keeps tour filter edits local until the modal applies them', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([]);

    const onFiltersChange = vi.fn();

    render(
      <WasteToursContent
        assignmentContextLoading={false}
        message={null}
        tours={
          [
            {
              id: 'tour-1',
              name: 'Restmüll Nord',
              recurrence: 'weekly',
              wasteFractionIds: [],
              locationCount: 0,
              customDates: [],
              active: true,
            },
          ] as never
        }
        fractions={
          [
            { id: 'fraction-1', name: 'Papier' },
            { id: 'fraction-2', name: 'Bio' },
          ] as never
        }
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
        tourValidityPeriod="all"
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
    fireEvent.change(screen.getByLabelText('tours.filters.validityPeriodLabel'), {
      target: { value: 'next' },
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
    fireEvent.change(screen.getByLabelText('tours.filters.validityPeriodLabel'), {
      target: { value: 'current' },
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
      'current',
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
        tours={
          [
            {
              id: 'tour-1',
              name: 'Restmüll Nord',
              recurrence: 'weekly',
              wasteFractionIds: [],
              locationCount: 0,
              customDates: [],
              active: true,
            },
          ] as never
        }
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
        tourValidityPeriod="current"
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
    expect(onFiltersChange).toHaveBeenCalledWith(
      '',
      'all',
      'all',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
  });
});
