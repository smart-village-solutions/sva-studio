import { describe, expect, it } from 'vitest';

import {
  createWasteTourValidityYearRange,
  matchesWasteTourValidityPeriod,
  resolveWasteTourValidityYear,
} from '../src/waste-management.tours.validity-filter.js';

describe('waste tour validity year filter', () => {
  it('resolves relative periods and inclusive calendar-year boundaries', () => {
    expect(resolveWasteTourValidityYear('previous', 2026)).toBe(2025);
    expect(resolveWasteTourValidityYear('current', 2026)).toBe(2026);
    expect(resolveWasteTourValidityYear('next', 2026)).toBe(2027);
    expect(createWasteTourValidityYearRange('current', 2026)).toEqual({
      year: 2026,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
  });

  it('accepts open, enclosing, and single-day-overlapping validity periods', () => {
    expect(matchesWasteTourValidityPeriod({}, 'current', 2026)).toBe(true);
    expect(
      matchesWasteTourValidityPeriod(
        { firstDate: '2025-12-01', endDate: '2027-01-31' },
        'current',
        2026
      )
    ).toBe(true);
    expect(
      matchesWasteTourValidityPeriod(
        { firstDate: '2025-01-01', endDate: '2026-01-01' },
        'current',
        2026
      )
    ).toBe(true);
    expect(
      matchesWasteTourValidityPeriod(
        { firstDate: '2026-12-31', endDate: '2027-12-31' },
        'current',
        2026
      )
    ).toBe(true);
    expect(
      matchesWasteTourValidityPeriod(
        { firstDate: '2027-01-01', endDate: '2027-12-31' },
        'current',
        2026
      )
    ).toBe(false);
  });

  it('accepts explicit dates in the year independently from the validity period', () => {
    expect(
      matchesWasteTourValidityPeriod(
        {
          firstDate: '2027-01-01',
          endDate: '2027-12-31',
          customDates: [{ date: '2026-01-01' }, { date: '2026-12-31' }],
        },
        'current',
        2026
      )
    ).toBe(true);
    expect(
      matchesWasteTourValidityPeriod(
        { firstDate: '2027-01-01', customDates: [{ date: '2025-12-31' }] },
        'current',
        2026
      )
    ).toBe(false);
  });

  it('does not restrict tours for the all period', () => {
    expect(
      matchesWasteTourValidityPeriod(
        { firstDate: '2030-01-01', endDate: '2030-12-31' },
        'all',
        2026
      )
    ).toBe(true);
  });
});
