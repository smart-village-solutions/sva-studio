import { describe, expect, it } from 'vitest';

import { projectPublicWasteCalendar } from './public-waste-projection.js';

describe('public waste projection', () => {
  it('sorts upcoming entries and derives fraction filters', () => {
    const result = projectPublicWasteCalendar({
      referenceDate: '2026-05-18',
      upcomingEntries: [
        {
          id: 'pickup-2',
          date: '2026-05-21',
          fractionId: 'paper',
          fractionLabel: 'Papier',
          fractionColor: '#0000FF',
          note: null,
        },
        {
          id: 'pickup-1',
          date: '2026-05-19',
          fractionId: 'bio',
          fractionLabel: 'Bioabfall',
          fractionColor: '#00AA00',
          note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
        },
      ],
    });

    expect(result.nextPickupDate).toBe('2026-05-19');
    expect(result.listEntries.map((entry) => entry.id)).toEqual(['pickup-1', 'pickup-2']);
    expect(result.fractionOptions).toEqual([
      { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
      { id: 'paper', label: 'Papier', color: '#0000FF' },
    ]);
  });
});
