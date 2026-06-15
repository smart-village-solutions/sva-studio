import { describe, expect, it } from 'vitest';

import {
  calculateTourOccurrenceEntriesForYear,
  calculateTourOccurrencesForYear,
  countHolidayShiftedTourOccurrences,
  formatTourDateRange,
  formatTourRecurrence,
} from '../src/waste-management.tours.presentation.js';

describe('waste-management.tours.presentation', () => {
  it('formats all recurrence variants and missing date ranges', () => {
    const pt = (key: string) => key;

    expect(formatTourRecurrence(pt, 'weekly')).toBe('tours.recurrence.weekly');
    expect(formatTourRecurrence(pt, 'biweekly')).toBe('tours.recurrence.biweekly');
    expect(formatTourRecurrence(pt, 'fourweekly')).toBe('tours.recurrence.fourweekly');
    expect(formatTourRecurrence(pt, 'yearly')).toBe('tours.recurrence.yearly');
    expect(formatTourRecurrence(pt, 'on-demand')).toBe('tours.recurrence.onDemand');
    expect(formatTourRecurrence(pt, 'custom')).toBe('tours.recurrence.custom');
    expect(formatTourRecurrence(pt, undefined, 'Ferienmodus', 10)).toBe('tours.meta.customRecurrenceLabel');
    expect(formatTourDateRange({ firstDate: '2026-04-01', endDate: '2026-04-08' } as never)).toBe('2026-04-01 – 2026-04-08');
    expect(formatTourDateRange({ firstDate: '2026-04-01', endDate: undefined } as never)).toBe('2026-04-01');
    expect(formatTourDateRange({ firstDate: undefined, endDate: undefined } as never)).toBe('—');
  });

  it('collects recurrence-specific dates, ignores invalid ranges, and applies global shifts without explicit tour ids', () => {
    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-biweekly',
          recurrence: 'biweekly',
          firstDate: '2026-01-15',
          endDate: '2026-02-20',
          customDates: [{ date: '2027-01-01' }],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [{ originalDate: '2026-01-28', actualDate: '2026-01-30' }],
        } as never
      )
    ).toEqual(['2026-01-15', '2026-01-29', '2026-02-12']);

    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-fourweekly',
          recurrence: 'fourweekly',
          firstDate: '2026-01-29',
          endDate: '2026-02-28',
          customDates: [],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
        } as never
      )
    ).toEqual(['2026-01-29', '2026-02-26']);

    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-yearly',
          recurrence: 'yearly',
          firstDate: '2025-06-02',
          endDate: '2027-07-01',
          customDates: [{ date: '2026-08-09' }],
        } as never,
        2026,
        {
          tourDateShifts: [{ tourId: 'tour-yearly', originalDate: '2026-06-01', actualDate: '2026-06-03' }],
          globalDateShifts: [],
        } as never
      )
    ).toEqual(['2026-06-02', '2026-08-09']);

    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-invalid',
          recurrence: 'weekly',
          firstDate: 'invalid',
          endDate: 'also-invalid',
          customDates: [{ date: '2026-09-09' }],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
        } as never
      )
    ).toEqual(['2026-09-09']);
  });

  it('returns no occurrences when the tour has no recurrence or no first date', () => {
    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-none',
          recurrence: undefined,
          firstDate: '2026-01-01',
          customDates: [],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
        } as never
      )
    ).toEqual([]);

    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-no-start',
          recurrence: 'weekly',
          firstDate: undefined,
          customDates: [{ date: '2025-01-01' }],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
        } as never
      )
    ).toEqual([]);
  });

  it('supports custom recurrence presets with day-based intervals', () => {
    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-preset',
          recurrence: undefined,
          customRecurrenceName: 'Ferienmodus',
          customRecurrenceIntervalDays: 10,
          firstDate: '2026-01-05',
          endDate: '2026-02-01',
          customDates: [],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
        } as never
      )
    ).toEqual(['2026-01-05', '2026-01-15', '2026-01-25']);
  });

  it('ignores unsupported recurrence strategies, undefined custom date arrays, and unrelated global shifts', () => {
    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-on-demand',
          recurrence: 'on-demand',
          firstDate: '2026-01-01',
          endDate: '2026-01-31',
          customDates: undefined,
        } as never,
        2026,
        {
          tourDateShifts: undefined,
          globalDateShifts: [
            { originalDate: '2026-01-01', actualDate: '2026-01-02', tourIds: ['other-tour'] },
          ],
        } as never
      )
    ).toEqual([]);
  });

  it('applies global shifts that explicitly target the active tour id', () => {
    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-targeted-shift',
          recurrence: 'weekly',
          firstDate: '2026-01-07',
          endDate: '2026-01-07',
          customDates: [],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [
            { originalDate: '2026-01-06', actualDate: '2026-01-08', tourIds: ['tour-targeted-shift'] },
          ],
        } as never
      )
    ).toEqual(['2026-01-07']);
  });

  it('falls back to an empty global shift list when the scheduling overview omits it', () => {
    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-no-global-shifts',
          recurrence: 'weekly',
          firstDate: '2026-01-07',
          endDate: '2026-01-07',
          customDates: [],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: undefined,
        } as never
      )
    ).toEqual(['2026-01-07']);
  });

  it('applies full-week holiday postponements to affected tour dates in the same week', () => {
    expect(
      calculateTourOccurrencesForYear(
        {
          id: 'tour-holiday-rule',
          recurrence: undefined,
          firstDate: undefined,
          customDates: [{ date: '2026-01-01' }, { date: '2026-01-02' }],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
          holidayRules: [
            {
              holidayDate: '2025-12-31T23:00:00.000Z',
              holidayName: 'Neujahrstag',
              scope: 'full-week',
              strategy: 'postpone',
            },
          ],
        } as never
      )
    ).toEqual(['2026-01-02', '2026-01-03']);
  });

  it('marks shifted tour occurrences explicitly for calendar rendering', () => {
    expect(
      calculateTourOccurrenceEntriesForYear(
        {
          id: 'tour-shifted-entries',
          recurrence: undefined,
          firstDate: undefined,
          customDates: [{ date: '2026-01-01' }, { date: '2026-01-08' }],
        } as never,
        2026,
        {
          tourDateShifts: [],
          globalDateShifts: [],
          holidayRules: [
            {
              holidayDate: '2025-12-31T23:00:00.000Z',
              holidayName: 'Neujahrstag',
              scope: 'full-week',
              strategy: 'postpone',
            },
          ],
        } as never
      )
    ).toEqual([
      { date: '2026-01-02', shifted: true, originalDate: '2026-01-01' },
      { date: '2026-01-08', shifted: false, originalDate: null },
    ]);
  });

  it('counts holiday-driven shifts for a tour across the affected holiday years', () => {
    expect(
      countHolidayShiftedTourOccurrences(
        {
          id: 'tour-holiday-count',
          recurrence: undefined,
          firstDate: undefined,
          customDates: [{ date: '2026-01-01' }, { date: '2026-01-02' }, { date: '2027-01-01' }],
        } as never,
        {
          tourDateShifts: [],
          globalDateShifts: [],
          holidayRules: [
            {
              holidayDate: '2025-12-31T23:00:00.000Z',
              holidayName: 'Neujahrstag',
              scope: 'full-week',
              strategy: 'postpone',
            },
          ],
        } as never
      )
    ).toBe(2);
  });
});
