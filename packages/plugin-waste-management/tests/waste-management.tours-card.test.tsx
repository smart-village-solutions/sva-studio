import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveTourAssignmentItemsMock = vi.hoisted(() => vi.fn());

import { WasteToursCard } from '../src/waste-management.tours-card.js';

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

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({
    children,
    variant,
  }: {
    readonly children: React.ReactNode;
    readonly variant?: string;
  }) => <span data-testid="badge" data-variant={variant ?? 'default'}>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
}));

describe('WasteToursCard', () => {
  beforeEach(() => {
    resolveTourAssignmentItemsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders metadata, custom dates, assignments, and action callbacks for active tours', () => {
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
      <WasteToursCard
        tour={tour as never}
        masterDataOverview={{} as never}
        onOpenEditDialog={onOpenEditDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        onOpenCalendar={onOpenCalendar}
      />
    );

    expect(screen.getByText('Restmüll Nord')).toBeTruthy();
    expect(screen.getByText('Wöchentliche Abholung')).toBeTruthy();
    expect(screen.getByText('common.active')).toBeTruthy();
    expect(screen.getByText('tours.meta.recurrence:recurrence:weekly')).toBeTruthy();
    expect(screen.getByText('tours.meta.fractionCount:2')).toBeTruthy();
    expect(screen.getByText('tours.meta.locationCount:4')).toBeTruthy();
    expect(screen.getByText('tours.meta.dateRange:range:tour-1')).toBeTruthy();
    expect(screen.getByText('tours.meta.tourId:tour-1')).toBeTruthy();
    expect(screen.getByText('2026-12-24 · Weihnachten')).toBeTruthy();
    expect(screen.getByText('2026-12-31')).toBeTruthy();
    expect(screen.getByText('tours.assignments.title')).toBeTruthy();
    expect(screen.getByText('tours.assignments.meta.startDate:2026-05-01')).toBeTruthy();
    expect(screen.getByText('tours.assignments.meta.endDate:2026-12-31')).toBeTruthy();

    const [editButton, createAssignmentsButton, openCalendarButton] = [
      screen.getByRole('button', { name: 'tours.actions.edit' }),
      screen.getByRole('button', { name: 'tours.assignments.actions.openCreate' }),
      screen.getByRole('button', { name: 'tours.yearCalendar.actions.open' }),
    ];
    fireEvent.click(editButton);
    fireEvent.click(createAssignmentsButton);
    fireEvent.click(openCalendarButton);
    fireEvent.click(screen.getAllByRole('button', { name: 'tours.assignments.actions.edit' })[0]!);

    expect(onOpenEditDialog).toHaveBeenCalledWith(tour);
    expect(onOpenCreateAssignmentsDialog).toHaveBeenCalledWith(tour);
    expect(onOpenCalendar).toHaveBeenCalledWith(tour);
    expect(onOpenEditAssignmentsDialog).toHaveBeenCalledWith(tour, 'link-1');

    const variants = screen.getAllByTestId('badge').map((element) => element.getAttribute('data-variant'));
    expect(variants).toContain('default');
    expect(variants).toContain('outline');
  });

  it('omits optional sections for inactive tours without master-data context', () => {
    resolveTourAssignmentItemsMock.mockReturnValue([
      {
        id: 'link-ignored',
        label: 'Ignored',
        startDate: '2026-01-01',
        endDate: '2026-02-01',
      },
    ]);

    render(
      <WasteToursCard
        tour={{
          id: 'tour-2',
          name: 'Papier Süd',
          description: '',
          recurrence: undefined,
          wasteFractionIds: [],
          locationCount: undefined,
          customDates: [],
          active: false,
        } as never}
        masterDataOverview={null}
        onOpenEditDialog={() => undefined}
        onOpenCreateAssignmentsDialog={() => undefined}
        onOpenEditAssignmentsDialog={() => undefined}
        onOpenCalendar={() => undefined}
      />
    );

    expect(screen.queryByText('tours.assignments.title')).toBeNull();
    expect(screen.queryByText('Ignored')).toBeNull();
    expect(screen.queryByText('tours.customDates.title')).toBeNull();
    expect(screen.queryByText('Wöchentliche Abholung')).toBeNull();
    expect(screen.getByText('common.inactive')).toBeTruthy();
    expect(screen.getByText('tours.meta.locationCount:0')).toBeTruthy();
    expect(screen.getByText('tours.meta.recurrence:recurrence:none')).toBeTruthy();
  });
});
