import { describe, expect, it } from 'vitest';

import { mergeCalendarAssignmentEntries } from './public-waste-calendar-loader.assignments.js';
import type {
  GlobalDateShiftRow,
  TourAssignmentRow,
  TourDateShiftRow,
} from './public-waste-calendar-loader.types.js';

const assignment = (overrides: Partial<TourAssignmentRow> = {}): TourAssignmentRow => ({
  assignment_id: 'assignment-1',
  pickup_date: '2026-05-19',
  tour_id: 'tour-1',
  tour_name: 'Restmüll',
  tour_description: null,
  fraction_id: 'fraction-1',
  fraction_label: 'Restmüll',
  fraction_description: null,
  fraction_pdf_short_label: null,
  fraction_color: null,
  note: null,
  ...overrides,
});

const tourShift = (overrides: Partial<TourDateShiftRow> = {}): TourDateShiftRow => ({
  id: 'tour-shift-1',
  tour_id: 'tour-1',
  original_date: '2026-05-19',
  actual_date: '2026-05-20',
  has_year: true,
  description: 'Tour wurde verschoben',
  ...overrides,
});

const globalShift = (overrides: Partial<GlobalDateShiftRow> = {}): GlobalDateShiftRow => ({
  id: 'global-shift-1',
  original_date: '2026-05-19',
  actual_date: '2026-05-21',
  description: 'Allgemein verschoben',
  tour_ids: null,
  ...overrides,
});

const mergeAssignment = (input: {
  readonly tourDateShiftRows?: readonly TourDateShiftRow[];
  readonly globalDateShiftRows?: readonly GlobalDateShiftRow[];
}) =>
  mergeCalendarAssignmentEntries({
    calculatedEntries: [],
    assignmentRows: [assignment()],
    tourDateShiftRows: input.tourDateShiftRows ?? [],
    globalDateShiftRows: input.globalDateShiftRows ?? [],
    holidayRules: [],
    windowStart: '2025-01-01',
    windowEnd: '2027-01-01',
  });

describe('public waste calendar assignment projection', () => {
  it('uses the tour-shift description when an assignment has no note', () => {
    expect(mergeAssignment({ tourDateShiftRows: [tourShift()] })).toContainEqual(
      expect.objectContaining({
        date: '2026-05-20',
        note: 'Tour wurde verschoben',
      })
    );
  });

  it('keeps the global description fallback when the preferred tour shift has no description', () => {
    expect(
      mergeAssignment({
        tourDateShiftRows: [tourShift({ description: null })],
        globalDateShiftRows: [globalShift()],
      })
    ).toContainEqual(
      expect.objectContaining({
        date: '2026-05-20',
        note: 'Allgemein verschoben',
      })
    );
  });

  it('prefers a tour-scoped global shift over a shared global shift', () => {
    expect(
      mergeAssignment({
        globalDateShiftRows: [
          globalShift(),
          globalShift({
            id: 'scoped-shift-1',
            actual_date: '2026-05-22',
            description: 'Nur diese Tour verschoben',
            tour_ids: ['tour-1'],
          }),
        ],
      })
    ).toContainEqual(
      expect.objectContaining({
        date: '2026-05-22',
        note: 'Nur diese Tour verschoben',
      })
    );
  });

  it('ignores invalid tour and scoped-global shifts before applying a valid shared shift', () => {
    expect(
      mergeAssignment({
        tourDateShiftRows: [tourShift({ actual_date: 'not-a-date' })],
        globalDateShiftRows: [
          globalShift({ actual_date: '2026-05-23' }),
          globalShift({
            id: 'invalid-scoped-shift',
            actual_date: 'not-a-date',
            tour_ids: ['tour-1'],
          }),
        ],
      })
    ).toContainEqual(
      expect.objectContaining({
        date: '2026-05-23',
        note: 'Allgemein verschoben',
      })
    );
  });
});
