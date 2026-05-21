import { describe, expect, it } from 'vitest';

import { calculatePublicWasteCalendarEntries } from './public-waste-calendar-occurrences.js';

describe('public waste calendar occurrences', () => {
  it('derives location entries from linked recurring tours, custom dates, and date shifts', () => {
    const entries = calculatePublicWasteCalendarEntries({
      referenceDate: '2026-05-18',
      selection: {
        cityId: 'c-1',
        streetId: 's-1',
        houseNumberId: 'h-1',
      },
      linkedTours: [
        {
          linkId: 'link-1',
          locationId: 'loc-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          tour: {
            id: 'tour-bio',
            name: 'Biotour',
            recurrence: 'biweekly',
            firstDate: '2026-05-20',
            endDate: '2026-06-30',
            customDates: [{ date: '2026-06-05', description: 'Zusatzleerung' }],
            fractions: [{ id: 'bio', label: 'Biotonne', color: '#00AA00' }],
          },
        },
        {
          linkId: 'link-2',
          locationId: 'loc-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          tour: {
            id: 'tour-paper',
            name: 'Papiertour',
            recurrence: 'weekly',
            firstDate: '2026-05-21',
            endDate: '2026-05-28',
            customDates: [],
            fractions: [{ id: 'paper', label: 'Papier', color: '#0000FF' }],
          },
        },
      ],
      tourDateShifts: [
        {
          id: 'shift-tour-1',
          tourId: 'tour-bio',
          originalDate: '2026-06-03',
          actualDate: '2026-06-04',
          description: 'Verschoben wegen Feiertag',
        },
      ],
      globalDateShifts: [
        {
          id: 'shift-global-1',
          originalDate: '2026-05-21',
          actualDate: '2026-05-22',
          description: 'Straßenfest',
          tourIds: ['tour-paper'],
        },
      ],
    });

    expect(entries).toEqual([
      {
        id: 'tour-bio:2026-05-20:bio',
        date: '2026-05-20',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        note: null,
      },
      {
        id: 'tour-paper:2026-05-22:paper',
        date: '2026-05-22',
        fractionId: 'paper',
        fractionLabel: 'Papier',
        fractionColor: '#0000FF',
        note: 'Straßenfest',
      },
      {
        id: 'tour-paper:2026-05-28:paper',
        date: '2026-05-28',
        fractionId: 'paper',
        fractionLabel: 'Papier',
        fractionColor: '#0000FF',
        note: null,
      },
      {
        id: 'tour-bio:2026-06-04:bio',
        date: '2026-06-04',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        note: 'Verschoben wegen Feiertag',
      },
      {
        id: 'tour-bio:2026-06-05:bio',
        date: '2026-06-05',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        note: 'Zusatzleerung',
      },
      {
        id: 'tour-bio:2026-06-17:bio',
        date: '2026-06-17',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        note: null,
      },
    ]);
  });
});
