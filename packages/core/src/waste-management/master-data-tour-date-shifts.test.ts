import { describe, expect, it } from 'vitest';

import { resolveEffectiveWasteTourDateShiftsForYear } from './master-data-tour-date-shifts.js';

const shift = (id: string, originalDate: string, actualDate: string, hasYear: boolean) => ({
  id,
  tourId: 'tour-1',
  originalDate,
  actualDate,
  hasYear,
});

describe('resolveEffectiveWasteTourDateShiftsForYear', () => {
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
        hasYear: true,
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

    expect(result).toEqual([expect.objectContaining({ id: 'specific', actualDate: '2026-05-04' })]);
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
});
