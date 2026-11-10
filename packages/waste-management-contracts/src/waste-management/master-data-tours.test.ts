import { describe, expect, it } from 'vitest';
import { isWasteTourGlobalDateShiftApplicable } from './master-data-tours.js';

import {
  isWasteTourValidityApplicable,
  resolveWasteTourValidityDates,
} from './master-data-tour-validity.js';

describe('waste tour validity', () => {
  it('recognizes fixed and preset recurrences as applicable', () => {
    expect(isWasteTourValidityApplicable({ recurrence: 'weekly' })).toBe(true);
    expect(
      isWasteTourValidityApplicable({ recurrence: 'custom', customRecurrenceId: 'preset-1' })
    ).toBe(true);
    expect(isWasteTourValidityApplicable({ recurrence: 'custom' })).toBe(false);
    expect(isWasteTourValidityApplicable({ recurrence: 'on-demand' })).toBe(false);
  });

  it('applies set, clear and unchanged operations independently', () => {
    expect(
      resolveWasteTourValidityDates(
        { firstDate: '2026-01-01', endDate: '2026-12-31' },
        {
          firstDate: { mode: 'unchanged' },
          endDate: { mode: 'clear' },
        }
      )
    ).toEqual({ firstDate: '2026-01-01' });

    expect(
      resolveWasteTourValidityDates(
        { firstDate: '2026-01-01', endDate: '2026-12-31' },
        {
          firstDate: { mode: 'set', value: '2026-02-01' },
          endDate: { mode: 'unchanged' },
        }
      )
    ).toEqual({ firstDate: '2026-02-01', endDate: '2026-12-31' });
  });

  it('rejects a resulting end date before the start date', () => {
    expect(
      resolveWasteTourValidityDates(
        { firstDate: '2026-05-01', endDate: '2026-12-31' },
        {
          firstDate: { mode: 'unchanged' },
          endDate: { mode: 'set', value: '2026-04-30' },
        }
      )
    ).toBeNull();
  });

  it('rejects clearing the recurrence start anchor', () => {
    expect(
      resolveWasteTourValidityDates(
        { firstDate: '2026-05-01', endDate: '2026-12-31' },
        {
          firstDate: { mode: 'clear' },
          endDate: { mode: 'unchanged' },
        }
      )
    ).toBeNull();
  });
});

describe('global shift applicability', () => {
  it.each(['weekly', 'biweekly', 'fourweekly', 'yearly'] as const)(
    'includes %s tours',
    (recurrence) => {
      expect(isWasteTourGlobalDateShiftApplicable({ recurrence })).toBe(true);
    }
  );
  it.each(['custom', 'on-demand', null, undefined] as const)(
    'excludes individual %s tours but includes resolved interval presets',
    (recurrence) => {
      expect(isWasteTourGlobalDateShiftApplicable({ recurrence })).toBe(false);
      expect(
        isWasteTourGlobalDateShiftApplicable({ recurrence, customRecurrenceIntervalDays: 10 })
      ).toBe(true);
    }
  );
});
