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
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>,
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
        masterDataOverview={{} as never}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={onOpenEditDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        onOpenCalendar={onOpenCalendar}
      />
    );

    expect(screen.getByText('tour message')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'tours.table.ariaLabel' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.name' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.status' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.recurrence' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.assignments' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'tours.table.actions' })).toBeTruthy();
    expect(screen.getByText('Restmüll Nord')).toBeTruthy();
    expect(screen.getByText('Wöchentliche Abholung')).toBeTruthy();
    expect(screen.getByText('common.active')).toBeTruthy();
    expect(screen.getByText('recurrence:weekly')).toBeTruthy();
    expect(screen.getByText('tours.meta.fractionCount:2')).toBeTruthy();
    expect(screen.getByText('tours.meta.locationCount:4')).toBeTruthy();
    expect(screen.getByText('range:tour-1')).toBeTruthy();
    expect(screen.getByText('tour-1')).toBeTruthy();
    expect(screen.getByText('Musterstraße 1')).toBeTruthy();
    expect(screen.getByText('Bahnhofstraße 2')).toBeTruthy();
    expect(screen.getByText('2026-12-24 · Weihnachten')).toBeTruthy();
    expect(screen.queryByText('tours.meta.count:1')).toBeNull();
    expect(screen.queryAllByTestId('badge')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'tours.actions.edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'tours.assignments.actions.openCreate' }));
    fireEvent.click(screen.getByRole('button', { name: 'tours.yearCalendar.actions.open' }));
    const [firstAssignmentEditButton] = screen.getAllByRole('button', { name: 'tours.assignments.actions.edit' });
    expect(firstAssignmentEditButton).toBeTruthy();
    fireEvent.click(firstAssignmentEditButton as HTMLButtonElement);

    expect(onOpenEditDialog).toHaveBeenCalledWith(tour);
    expect(onOpenCreateAssignmentsDialog).toHaveBeenCalledWith(tour);
    expect(onOpenCalendar).toHaveBeenCalledWith(tour);
    expect(onOpenEditAssignmentsDialog).toHaveBeenCalledWith(tour, 'link-1');
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
        masterDataOverview={null}
        onOpenCreateDialog={vi.fn()}
        onOpenEditDialog={vi.fn()}
        onOpenCreateAssignmentsDialog={vi.fn()}
        onOpenEditAssignmentsDialog={vi.fn()}
        onOpenCalendar={vi.fn()}
      />
    );

    expect(screen.getByText('tours.table.loadingAssignments')).toBeTruthy();
  });
});
