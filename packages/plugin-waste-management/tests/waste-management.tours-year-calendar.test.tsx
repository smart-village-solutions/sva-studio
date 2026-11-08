import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calculateTourOccurrenceEntriesForYearMock = vi.hoisted(() => vi.fn());

import { TourYearCalendarDialog } from '../src/waste-management.tours-year-calendar.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
  resolveEditorLocale: () => (document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE'),
}));

vi.mock('@sva/waste-management-contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/waste-management-contracts')>()),
  isWasteTourValidityApplicable: (tour: { recurrence?: string; customRecurrenceId?: string }) =>
    Boolean(tour.customRecurrenceId) ||
    ['weekly', 'biweekly', 'fourweekly', 'yearly'].includes(tour.recurrence ?? ''),
}));

vi.mock('../src/waste-management.tours.presentation.js', () => ({
  calculateTourCalendarForYear: (...args: unknown[]) => {
    const result = calculateTourOccurrenceEntriesForYearMock(...args);
    return Array.isArray(result)
      ? { entries: result, issues: [], outsideValidityMonths: Array(12).fill(false) }
      : result;
  },
}));

vi.mock('../src/waste-management.tour-shift-create-link.js', () => ({
  WasteTourShiftCreateLink: ({
    label,
    originalDate,
    children,
  }: {
    readonly label: string;
    readonly originalDate?: string;
    readonly children?: React.ReactNode;
  }) => (
    <a
      href={`/plugins/waste-management?originalDate=${originalDate ?? ''}`}
      target="_blank"
      aria-label={label}
    >
      {children ?? label}
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

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Dialog: ({ open, children }: { readonly open: boolean; readonly children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({
    children,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly className?: string;
  }) => <div className={className}>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe('TourYearCalendarDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T09:00:00.000Z'));
    calculateTourOccurrenceEntriesForYearMock.mockReset();
    document.documentElement.lang = 'de';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens in the year of the tour start date', () => {
    calculateTourOccurrenceEntriesForYearMock.mockReturnValue([]);
    render(
      <TourYearCalendarDialog
        open
        tour={
          { id: 'tour-2027', name: 'Bio', firstDate: '2027-01-07', recurrence: 'biweekly' } as never
        }
        scheduling={{ globalDateShifts: [], tourDateShifts: [] } as never}
        onOpenChange={() => undefined}
      />
    );
    expect(screen.getByText('tours.yearCalendar.meta.year:2027')).toBeTruthy();
    expect(calculateTourOccurrenceEntriesForYearMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tour-2027' }),
      2027,
      expect.anything()
    );
  });

  it('opens an ongoing tour from an earlier year in the current year', () => {
    calculateTourOccurrenceEntriesForYearMock.mockReturnValue([]);
    render(
      <TourYearCalendarDialog
        open
        tour={
          {
            id: 'long-running',
            name: 'Restmüll',
            firstDate: '2019-01-01',
            recurrence: 'weekly',
          } as never
        }
        scheduling={{ globalDateShifts: [], tourDateShifts: [] } as never}
        onOpenChange={() => undefined}
      />
    );
    expect(screen.getByText('tours.yearCalendar.meta.year:2026')).toBeTruthy();
    expect(calculateTourOccurrenceEntriesForYearMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'long-running' }),
      2026,
      expect.anything()
    );
  });

  it('renders highlighted dates and lets the user navigate between years', () => {
    calculateTourOccurrenceEntriesForYearMock.mockImplementation((_tour, year: number) =>
      year === 2026
        ? [
            { date: '2026-01-15', shifted: false, originalDate: null },
            { date: '2026-03-02', shifted: true, originalDate: '2026-03-01' },
          ]
        : [{ date: '2025-12-30', shifted: false, originalDate: null }]
    );

    const { container } = render(
      <TourYearCalendarDialog
        open
        tour={{ id: 'tour-1', name: 'Restmüll Nord', recurrence: 'weekly' } as never}
        scheduling={{ globalDateShifts: [], tourDateShifts: [] } as never}
        canManageScheduling
        search={toursSearch}
        onOpenChange={() => undefined}
      />
    );

    expect(screen.getByText('tours.yearCalendar.title')).toBeTruthy();
    expect(screen.getByText('tours.yearCalendar.description:Restmüll Nord')).toBeTruthy();
    expect(screen.getByText('tours.yearCalendar.meta.year:2026')).toBeTruthy();
    expect(screen.getByText('2026-01-15')).toBeTruthy();
    expect(screen.getByText('2026-03-02')).toBeTruthy();
    expect(calculateTourOccurrenceEntriesForYearMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tour-1' }),
      2026,
      expect.anything()
    );

    const highlightedDays = Array.from(container.querySelectorAll('.bg-primary')).map((element) =>
      element.textContent?.trim()
    );
    expect(highlightedDays.some((value) => value.startsWith('15'))).toBe(true);
    expect(container.querySelector('[data-shifted="false"]')?.textContent).toContain('15');
    expect(container.querySelector('[data-shifted="true"]')?.textContent).toContain('2');
    const shiftedDay = container.querySelector('[data-shifted="true"]');
    expect(shiftedDay?.getAttribute('style')).toBeNull();
    expect(shiftedDay?.className).toContain('border-input');
    expect(shiftedDay?.getAttribute('tabindex')).toBe('0');
    expect(shiftedDay?.getAttribute('aria-describedby')).toBe(
      shiftedDay?.querySelector('.sr-only')?.id
    );
    expect(shiftedDay?.querySelector('[aria-hidden="true"]')?.className).toContain(
      'group-focus:block'
    );
    expect(shiftedDay?.querySelector('.sr-only')?.textContent).toBe(
      'tours.yearCalendar.meta.shiftedReplacementFor:01.03.2026'
    );
    const shiftLinks = screen.getAllByRole('link', {
      name: /tours\.actions\.shiftDateAccessible/,
    });
    expect(shiftLinks).toHaveLength(2);
    expect(container.querySelectorAll('[id]').length).toBe(
      new Set(Array.from(container.querySelectorAll('[id]'), (element) => element.id)).size
    );
    expect(container.querySelector('[data-year-calendar-layout="list"]')?.textContent).toContain(
      '15.01.2026'
    );
    expect(shiftLinks[0]?.getAttribute('href')).toBe(
      '/plugins/waste-management?originalDate=2026-01-15'
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'tours.yearCalendar.actions.previousYear' })
    );
    expect(screen.getByText('tours.yearCalendar.meta.year:2025')).toBeTruthy();
    expect(screen.getByText('2025-12-30')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.yearCalendar.actions.nextYear' }));
    expect(screen.getByText('tours.yearCalendar.meta.year:2026')).toBeTruthy();
  });

  it('resets the year on reopen and shows fallbacks when no tour dates are available', () => {
    calculateTourOccurrenceEntriesForYearMock.mockReturnValue([]);
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <TourYearCalendarDialog open tour={null} scheduling={null} onOpenChange={onOpenChange} />
    );

    expect(screen.getByText('tours.yearCalendar.descriptionFallback')).toBeTruthy();
    expect(screen.getByText('tours.yearCalendar.meta.unavailable')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.yearCalendar.actions.nextYear' }));
    expect(screen.getByText('tours.yearCalendar.meta.year:2027')).toBeTruthy();

    rerender(
      <TourYearCalendarDialog
        open={false}
        tour={null}
        scheduling={null}
        onOpenChange={onOpenChange}
      />
    );
    expect(screen.queryByTestId('dialog-root')).toBeNull();

    rerender(
      <TourYearCalendarDialog open tour={null} scheduling={null} onOpenChange={onOpenChange} />
    );
    expect(screen.getByText('tours.yearCalendar.meta.year:2026')).toBeTruthy();
    expect(calculateTourOccurrenceEntriesForYearMock).not.toHaveBeenCalled();
  });

  it('shows the shifted replacement label only for shifted dates', () => {
    calculateTourOccurrenceEntriesForYearMock.mockReturnValue([
      { date: '2026-01-02', shifted: true, originalDate: '2026-01-01' },
      { date: '2026-01-08', shifted: false, originalDate: null },
    ]);

    const { container } = render(
      <TourYearCalendarDialog
        open
        tour={{ id: 'tour-1', name: 'Restmüll Nord' } as never}
        scheduling={{ globalDateShifts: [], tourDateShifts: [] } as never}
        onOpenChange={() => undefined}
      />
    );

    expect(
      container.querySelector('[data-shifted="true"]')?.querySelector('.sr-only')?.textContent
    ).toBe('tours.yearCalendar.meta.shiftedReplacementFor:01.01.2026');
    expect(container.querySelector('[data-shifted="false"]')?.getAttribute('title')).toBeNull();
  });

  it('formats dates, month names, and weekday labels with the active document locale', () => {
    document.documentElement.lang = 'en';
    calculateTourOccurrenceEntriesForYearMock.mockReturnValue([
      { date: '2026-03-02', shifted: true, originalDate: '2026-03-01' },
    ]);

    const { container } = render(
      <TourYearCalendarDialog
        open
        tour={{ id: 'tour-1', name: 'Residual waste', recurrence: 'weekly' } as never}
        scheduling={{ globalDateShifts: [], tourDateShifts: [] } as never}
        onOpenChange={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'March' })).toBeTruthy();
    expect(screen.getAllByText('Mon').length).toBeGreaterThan(0);
    expect(
      container.querySelector('[data-shifted="true"]')?.querySelector('.sr-only')?.textContent
    ).toBe('tours.yearCalendar.meta.shiftedReplacementFor:01/03/2026');
  });
});

describe('annual calendar status with real calculation inputs', () => {
  afterEach(() => cleanup());
  const tour = {
    id: 'status-tour',
    name: 'Status',
    recurrence: 'weekly',
    firstDate: '2026-01-01',
    endDate: '2026-12-31',
  };
  const scheduling = { tourDateShifts: [], globalDateShifts: [], holidayRules: [] };
  const props = { open: true, scheduling: scheduling as never, onOpenChange: () => undefined };

  it('distinguishes loading, failed loading and a successfully calculated empty month', async () => {
    const { calculateTourCalendarForYear } = await vi.importActual<
      typeof import('../src/waste-management.tours.presentation.js')
    >('../src/waste-management.tours.presentation.js');
    calculateTourOccurrenceEntriesForYearMock.mockImplementation(calculateTourCalendarForYear);
    const { rerender, container } = render(
      <TourYearCalendarDialog
        {...props}
        tour={tour as never}
        scheduling={null}
        schedulingLoadState="loading"
      />
    );
    expect(screen.getByRole('status').textContent).toContain('tours.yearCalendar.meta.loading');
    expect(screen.queryByText('tours.yearCalendar.meta.noDates')).toBeNull();
    rerender(
      <TourYearCalendarDialog
        {...props}
        tour={tour as never}
        scheduling={null}
        schedulingLoadState="error"
      />
    );
    expect(screen.getByRole('status').textContent).toContain('tours.yearCalendar.meta.loadError');
    expect(screen.queryByText('tours.yearCalendar.meta.loading')).toBeNull();
    rerender(
      <TourYearCalendarDialog
        {...props}
        tour={{ ...tour, recurrence: 'custom', firstDate: undefined } as never}
        schedulingLoadState="ready"
      />
    );
    expect(screen.getAllByText('tours.yearCalendar.meta.noDatesInMonth')).toHaveLength(12);
    expect(screen.getByText('tours.yearCalendar.meta.noDates')).toBeTruthy();
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('keeps partial dates in both layouts and updates status together with the year and tour', async () => {
    const { calculateTourCalendarForYear } = await vi.importActual<
      typeof import('../src/waste-management.tours.presentation.js')
    >('../src/waste-management.tours.presentation.js');
    calculateTourOccurrenceEntriesForYearMock.mockImplementation(calculateTourCalendarForYear);
    const partialTour = { ...tour, firstDate: undefined, customDates: [{ date: '2026-03-02' }] };
    const { container, rerender } = render(
      <TourYearCalendarDialog {...props} tour={partialTour as never} />
    );
    expect(screen.getByRole('status').textContent).toContain('tours.yearCalendar.meta.partial');
    expect(screen.getByText('tours.yearCalendar.meta.missingStartDate')).toBeTruthy();
    expect(screen.getByText('2026-03-02')).toBeTruthy();
    expect(container.querySelectorAll('[data-shifted="false"]')).toHaveLength(2);
    expect(screen.queryByText('tours.yearCalendar.meta.noDatesInMonth')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'tours.yearCalendar.actions.nextYear' }));
    expect(screen.queryByText('2026-03-02')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('tours.yearCalendar.meta.unavailable');
    rerender(
      <TourYearCalendarDialog
        {...props}
        tour={{ ...tour, id: 'other', recurrence: 'custom' } as never}
      />
    );
    expect(screen.queryByText('tours.yearCalendar.meta.missingStartDate')).toBeNull();
  });
});
