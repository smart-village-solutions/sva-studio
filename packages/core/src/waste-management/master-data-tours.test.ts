import { describe, expect, it } from 'vitest';

import {
  isWasteTourValidityApplicable,
  resolveWasteTourValidityDates,
} from './master-data-tours.js';

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
});
