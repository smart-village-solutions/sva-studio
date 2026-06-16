import { describe, expect, it } from 'vitest';

import { projectPublicWasteCalendar } from './public-waste-projection.js';

describe('public waste projection', () => {
  it('sorts entries, keeps the next pickup date in the future, and derives fraction filters', () => {
    const result = projectPublicWasteCalendar({
      referenceDate: '2026-05-18',
      entries: [
        {
          id: 'pickup-0',
          date: '2025-12-19',
          fractionId: 'rest',
          fractionLabel: 'Restmüll',
          fractionColor: '#444444',
          note: null,
        },
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
    expect(result.listEntries.map((entry) => entry.id)).toEqual(['pickup-0', 'pickup-1', 'pickup-2']);
    expect(result.fractionOptions).toEqual([
      { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
      { id: 'paper', label: 'Papier', color: '#0000FF' },
      { id: 'rest', label: 'Restmüll', color: '#444444' },
    ]);
  });

  it('normalizes ISO timestamps before comparing the next pickup date', () => {
    const result = projectPublicWasteCalendar({
      referenceDate: '2026-05-19T12:00:00Z',
      entries: [
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
          date: '2026-05-21',
          fractionId: 'paper',
          fractionLabel: 'Papier',
          fractionColor: '#0000FF',
          note: null,
        },
      ],
    });

    expect(result.nextPickupDate).toBe('2026-05-19');
  });
});
