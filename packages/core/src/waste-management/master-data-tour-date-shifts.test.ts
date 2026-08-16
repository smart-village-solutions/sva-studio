import { describe, expect, it } from 'vitest';

import {
  isValidWasteIsoDateOnly,
  resolveEffectiveWasteTourDateShiftsForYear,
} from './master-data-tour-date-shifts.js';

const shift = (id: string, originalDate: string, actualDate: string, hasYear: boolean) => ({
  id,
  tourId: 'tour-1',
  originalDate,
  actualDate,
  hasYear,
});

describe('resolveEffectiveWasteTourDateShiftsForYear', () => {
  it('validates real four-digit Gregorian calendar dates', () => {
    expect(isValidWasteIsoDateOnly('2024-02-29')).toBe(true);
    expect(isValidWasteIsoDateOnly('2026-02-29')).toBe(false);
    expect(isValidWasteIsoDateOnly('2026-02-31')).toBe(false);
    expect(isValidWasteIsoDateOnly('0000-01-01')).toBe(false);
    expect(isValidWasteIsoDateOnly('2026-2-01')).toBe(false);
  });

  it('expands an annual rule while preserving its date distance', () => {
    expect(
      resolveEffectiveWasteTourDateShiftsForYear(
        [shift('annual', '2024-12-31', '2025-01-02', false)],
        2026
      )
    ).toEqual([
      expect.objectContaining({
        id: 'annual',
        originalDate: '2026-12-31',
        actualDate: '2027-01-02',
        hasYear: false,
        specificity: 'annual',
      }),
    ]);
  });

  it('prefers a year-specific rule over the annual rule for the same occurrence', () => {
    const result = resolveEffectiveWasteTourDateShiftsForYear(
      [
        shift('annual', '2024-05-01', '2024-05-02', false),
        shift('specific', '2026-05-01', '2026-05-04', true),
      ],
      2026
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'specific',
        actualDate: '2026-05-04',
        hasYear: true,
        specificity: 'year-specific',
      }),
    ]);
  });

  it('keeps annual rules in other years and rejects invalid calendar dates', () => {
    expect(
      resolveEffectiveWasteTourDateShiftsForYear(
        [
          shift('annual', '2024-05-01', '2024-05-02', false),
          shift('invalid', '2026-02-31', '2026-03-01', true),
        ],
        2027
      )
    ).toEqual([expect.objectContaining({ id: 'annual', originalDate: '2027-05-01' })]);
  });

  it('keeps date-only expansion identical across process time zones', () => {
    const previousTimeZone = process.env.TZ;
    const input = [shift('annual', '2024-03-31', '2024-04-01', false)];
    try {
      process.env.TZ = 'UTC';
      const utc = resolveEffectiveWasteTourDateShiftsForYear(input, 2026);
      process.env.TZ = 'Europe/Berlin';
      const berlin = resolveEffectiveWasteTourDateShiftsForYear(input, 2026);
      expect(berlin).toEqual(utc);
      expect(berlin[0]).toMatchObject({
        originalDate: '2026-03-31',
        actualDate: '2026-04-01',
      });
    } finally {
      process.env.TZ = previousTimeZone;
    }
  });

  it('selects equal-specificity duplicates deterministically regardless of input order', () => {
    const annualA = shift('annual-a', '2024-05-01', '2024-05-02', false);
    const annualB = shift('annual-b', '2023-05-01', '2023-05-03', false);
    const specificA = shift('specific-a', '2026-06-01', '2026-06-02', true);
    const specificB = shift('specific-b', '2026-06-01', '2026-06-03', true);

    const forward = resolveEffectiveWasteTourDateShiftsForYear(
      [annualB, specificB, annualA, specificA],
      2026
    );
    const reverse = resolveEffectiveWasteTourDateShiftsForYear(
      [specificA, annualA, specificB, annualB],
      2026
    );

    expect(reverse).toEqual(forward);
    expect(forward.map(({ id }) => id)).toEqual(['annual-a', 'specific-a']);
  });

  it('keeps tours independent when their original dates match', () => {
    const result = resolveEffectiveWasteTourDateShiftsForYear(
      [
        shift('tour-1-shift', '2024-05-01', '2024-05-02', false),
        {
          ...shift('tour-2-shift', '2024-05-01', '2024-05-03', false),
          tourId: 'tour-2',
        },
      ],
      2026
    );

    expect(result.map(({ id }) => id)).toEqual(['tour-1-shift', 'tour-2-shift']);
  });

  it('expands leap-day rules only into leap years', () => {
    const leapDay = shift('leap-day', '2024-02-29', '2024-03-01', false);

    expect(resolveEffectiveWasteTourDateShiftsForYear([leapDay], 2026)).toEqual([]);
    expect(resolveEffectiveWasteTourDateShiftsForYear([leapDay], 2028)).toEqual([
      expect.objectContaining({
        originalDate: '2028-02-29',
        actualDate: '2028-03-01',
        specificity: 'annual',
      }),
    ]);
  });

  it('rejects invalid actual dates and invalid target years', () => {
    expect(
      resolveEffectiveWasteTourDateShiftsForYear(
        [shift('invalid-actual', '2026-05-01', '2026-02-30', true)],
        2026
      )
    ).toEqual([]);
    expect(
      resolveEffectiveWasteTourDateShiftsForYear(
        [shift('annual', '2024-05-01', '2024-05-02', false)],
        Number.NaN
      )
    ).toEqual([]);
  });
});
