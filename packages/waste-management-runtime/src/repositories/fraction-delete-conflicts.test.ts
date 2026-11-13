import { describe, expect, it } from 'vitest';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import {
  findFractionReplacementConflicts,
  replaceFractionIds,
} from './fraction-delete-conflicts.js';

const tour = (
  id: string,
  fractions: string[],
  overrides: Partial<WasteTourRecord> = {}
): WasteTourRecord => ({
  id,
  name: id,
  status: 'published',
  wasteFractionIds: fractions,
  recurrence: 'weekly',
  firstDate: '2030-01-01',
  endDate: '2030-12-31',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});
const state = (tours: WasteTourRecord[]) => ({
  tours,
  links: tours.map((t) => ({
    id: t.id,
    tourId: t.id,
    locationId: 'place',
    createdAt: '',
    updatedAt: '',
  })),
  tourDateShifts: [],
  globalDateShifts: [],
  holidayRules: [],
});

describe('fraction replacement', () => {
  it('preserves target position, all other fractions and order without duplicates', () => {
    expect(replaceFractionIds(['a', 'source', 'b', 'target'], 'source', 'target')).toEqual([
      'a',
      'b',
      'target',
    ]);
    expect(replaceFractionIds(['a', 'source', 'b'], 'source', 'target')).toEqual([
      'a',
      'target',
      'b',
    ]);
    expect(replaceFractionIds(['a', 'source'], 'source')).toEqual(['a']);
  });
  it('detects collisions beyond the normal current-year calendar window', () => {
    const result = findFractionReplacementConflicts(
      state([tour('a', ['source']), tour('b', ['target'])]),
      'source',
      'target'
    );
    expect(result.blockedReason).toBe('date-conflict');
    expect(result.conflicts[0]).toEqual({
      tourIds: ['a', 'b'],
      locationId: 'place',
      pickupDate: '2030-01-01',
    });
  });
  it('resolves actual dates after tour shifts and distinct recurrence intervals', () => {
    const input = state([
      tour('a', ['source'], { firstDate: '2030-01-01', endDate: '2030-01-01' }),
      tour('b', ['target'], {
        firstDate: '2030-01-03',
        endDate: '2030-01-03',
        recurrence: 'biweekly',
      }),
    ]);
    const result = findFractionReplacementConflicts(
      {
        ...input,
        tourDateShifts: [
          {
            id: 'shift',
            tourId: 'a',
            originalDate: '2030-01-01',
            actualDate: '2030-01-03',
            hasYear: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
      'source',
      'target'
    );
    expect(result.conflicts[0]?.pickupDate).toBe('2030-01-03');
  });
  it('allows different dates, locations and unchanged existing target collisions', () => {
    expect(
      findFractionReplacementConflicts(
        state([tour('a', ['source'], { firstDate: '2030-01-02' }), tour('b', ['target'])]),
        'source',
        'target'
      ).blockedReason
    ).toBeNull();
    const separate = state([tour('a', ['source']), tour('b', ['target'])]);
    separate.links[1].locationId = 'elsewhere';
    expect(findFractionReplacementConflicts(separate, 'source', 'target').blockedReason).toBeNull();
    expect(
      findFractionReplacementConflicts(
        state([tour('a', ['source', 'target']), tour('b', ['target'])]),
        'source',
        'target'
      ).blockedReason
    ).toBeNull();
  });
  it('checks intermediate years instead of just the first and last display year', () => {
    const input = state([
      tour('a', ['source'], { firstDate: '2025-01-07', endDate: '2030-12-31' }),
      tour('b', ['target'], {
        recurrence: null,
        firstDate: undefined,
        endDate: undefined,
        customDates: [{ date: '2028-01-04' }],
      }),
    ]);
    expect(
      findFractionReplacementConflicts(input, 'source', 'target').conflicts[0]?.pickupDate
    ).toBe('2028-01-04');
  });
  it('checks explicit cross-year shifts and assignment-only pickups', () => {
    const input = state([
      tour('a', ['source'], {
        recurrence: null,
        firstDate: undefined,
        endDate: undefined,
        customDates: [{ date: '2026-12-31' }],
      }),
      tour('b', ['target'], {
        recurrence: null,
        firstDate: undefined,
        endDate: undefined,
        customDates: [{ date: '2028-01-04' }],
      }),
    ]);
    const shifted = {
      ...input,
      tourDateShifts: [
        {
          id: 'shift',
          tourId: 'a',
          originalDate: '2026-12-31',
          actualDate: '2028-01-04',
          hasYear: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
    };
    expect(
      findFractionReplacementConflicts(shifted, 'source', 'target').conflicts[0]?.pickupDate
    ).toBe('2028-01-04');
    const assigned = {
      ...input,
      links: [],
      tourAssignments: ['a', 'b'].map((id) => ({
        id,
        tourId: id,
        pickupDate: '2034-06-15',
        locationIds: ['place'],
        note: null,
        createdAt: '',
        updatedAt: '',
      })),
    };
    expect(
      findFractionReplacementConflicts(assigned, 'source', 'target').conflicts[0]?.pickupDate
    ).toBe('2034-06-15');
  });
  it('blocks incomplete checks of competing unbounded schedules but allows an isolated tour', () => {
    expect(
      findFractionReplacementConflicts(
        state([tour('a', ['source'], { endDate: undefined }), tour('b', ['target'])]),
        'source',
        'target'
      ).blockedReason
    ).toBe('unbounded-schedule');
    expect(
      findFractionReplacementConflicts(
        state([tour('a', ['source'], { endDate: undefined })]),
        'source',
        'target'
      ).blockedReason
    ).toBeNull();
  });
});
