import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calculateTourOccurrenceEntriesForYearMock = vi.hoisted(() => vi.fn());

import { TourYearCalendarDialog } from '../src/waste-management.tours-year-calendar.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('../src/waste-management.tours.presentation.js', () => ({
  calculateTourOccurrenceEntriesForYear: calculateTourOccurrenceEntriesForYearMock,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Dialog: ({
    open,
    children,
  }: {
    readonly open: boolean;
    readonly children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) => <div className={className}>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe('TourYearCalendarDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T09:00:00.000Z'));
    calculateTourOccurrenceEntriesForYearMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
        tour={{ id: 'tour-1', name: 'Restmüll Nord' } as never}
        scheduling={{ globalDateShifts: [], tourDateShifts: [] } as never}
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

    const highlightedDays = Array.from(container.querySelectorAll('.bg-primary')).map((element) => element.textContent?.trim());
    expect(highlightedDays).toContain('15');
    expect(container.querySelector('[data-shifted="false"]')?.textContent).toContain('15');
    expect(container.querySelector('[data-shifted="true"]')?.textContent).toContain('2');
    const shiftedDay = container.querySelector('[data-shifted="true"]');
    expect(shiftedDay?.getAttribute('style')).toContain('border-color: #009e8f');
    expect(shiftedDay?.getAttribute('style')).toContain('background-color: rgba(0, 158, 143, 0.16)');
    expect(shiftedDay?.getAttribute('title')).toBe('tours.yearCalendar.meta.shiftedReplacementFor:01.03.2026');

    fireEvent.click(screen.getByRole('button', { name: 'tours.yearCalendar.actions.previousYear' }));
    expect(screen.getByText('tours.yearCalendar.meta.year:2025')).toBeTruthy();
    expect(screen.getByText('2025-12-30')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'tours.yearCalendar.actions.nextYear' }));
    expect(screen.getByText('tours.yearCalendar.meta.year:2026')).toBeTruthy();
  });

  it('resets the year on reopen and shows fallbacks when no tour dates are available', () => {
    calculateTourOccurrenceEntriesForYearMock.mockReturnValue([]);
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <TourYearCalendarDialog
        open
        tour={null}
        scheduling={null}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText('tours.yearCalendar.descriptionFallback')).toBeTruthy();
    expect(screen.getByText('tours.yearCalendar.meta.noDates')).toBeTruthy();

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
      <TourYearCalendarDialog
        open
        tour={null}
        scheduling={null}
        onOpenChange={onOpenChange}
      />
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

    expect(container.querySelector('[data-shifted="true"]')?.getAttribute('title')).toBe(
      'tours.yearCalendar.meta.shiftedReplacementFor:01.01.2026'
    );
    expect(container.querySelector('[data-shifted="false"]')?.getAttribute('title')).toBeNull();
  });
});
