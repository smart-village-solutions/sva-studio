import { describe, expect, it } from 'vitest';

import { filterPublicWasteCalendarFractions } from './public-waste-view-model.js';

describe('public waste view model', () => {
  it('filters visible fractions without clearing the resolved location', () => {
    const result = filterPublicWasteCalendarFractions(
      {
        locationKey: 'r-1:c-1:s-1:h-1',
        nextPickupDate: '2026-05-19',
        listEntries: [
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionColor: '#00AA00',
            note: null,
          },
          {
            id: 'pickup-2',
            date: '2026-05-20',
            fractionId: 'paper',
            fractionLabel: 'Papier',
            fractionColor: '#0000FF',
            note: null,
          },
        ],
        monthBuckets: [],
        yearBuckets: [],
        fractionOptions: [
          { id: 'bio', label: 'Bioabfall' },
          { id: 'paper', label: 'Papier' },
        ],
      },
      ['bio']
    );

    expect(result.locationKey).toBe('r-1:c-1:s-1:h-1');
    expect(result.listEntries.map((entry) => entry.id)).toEqual(['pickup-1']);
    expect(result.activeFractionIds).toEqual(['bio']);
  });

  it('returns no visible entries when no fractions are active', () => {
    const result = filterPublicWasteCalendarFractions(
      {
        locationKey: 'r-1:c-1:s-1:h-1',
        nextPickupDate: '2026-05-19',
        listEntries: [
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionColor: '#00AA00',
            note: null,
          },
        ],
        monthBuckets: [],
        yearBuckets: [],
        fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
      },
      []
    );

    expect(result.listEntries).toEqual([]);
    expect(result.activeFractionIds).toEqual([]);
  });
});
