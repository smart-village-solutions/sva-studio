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
            description: 'Regelabfuhr fuer die Innenstadt.',
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
            description: 'Blaue Tonne fuer Papier und Kartonagen.',
            recurrence: 'weekly',
            firstDate: '2026-05-21',
            endDate: '2026-05-28',
            customDates: [],
            fractions: [{ id: 'paper', label: 'Papier', color: '#0000FF' }],
          },
        },
        {
          linkId: 'link-3',
          locationId: 'loc-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          tour: {
            id: 'tour-custom-preset',
            name: 'Ferientour',
            description: 'Abweichender Ferienrhythmus.',
            recurrence: null,
            customRecurrenceIntervalDays: 10,
            firstDate: '2026-05-19',
            endDate: '2026-06-10',
            customDates: [],
            fractions: [{ id: 'rest', label: 'Restmüll', color: '#444444' }],
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
        id: 'tour-custom-preset:2026-05-19:rest',
        date: '2026-05-19',
        fractionId: 'rest',
        fractionLabel: 'Restmüll',
        fractionColor: '#444444',
        tourName: 'Ferientour',
        tourDescription: 'Abweichender Ferienrhythmus.',
        note: null,
      },
      {
        id: 'tour-bio:2026-05-20:bio',
        date: '2026-05-20',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        tourName: 'Biotour',
        tourDescription: 'Regelabfuhr fuer die Innenstadt.',
        note: null,
      },
      {
        id: 'tour-paper:2026-05-22:paper',
        date: '2026-05-22',
        fractionId: 'paper',
        fractionLabel: 'Papier',
        fractionColor: '#0000FF',
        tourName: 'Papiertour',
        tourDescription: 'Blaue Tonne fuer Papier und Kartonagen.',
        note: 'Straßenfest',
      },
      {
        id: 'tour-paper:2026-05-28:paper',
        date: '2026-05-28',
        fractionId: 'paper',
        fractionLabel: 'Papier',
        fractionColor: '#0000FF',
        tourName: 'Papiertour',
        tourDescription: 'Blaue Tonne fuer Papier und Kartonagen.',
        note: null,
      },
      {
        id: 'tour-custom-preset:2026-05-29:rest',
        date: '2026-05-29',
        fractionId: 'rest',
        fractionLabel: 'Restmüll',
        fractionColor: '#444444',
        tourName: 'Ferientour',
        tourDescription: 'Abweichender Ferienrhythmus.',
        note: null,
      },
      {
        id: 'tour-bio:2026-06-04:bio',
        date: '2026-06-04',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        tourName: 'Biotour',
        tourDescription: 'Regelabfuhr fuer die Innenstadt.',
        note: 'Verschoben wegen Feiertag',
      },
      {
        id: 'tour-bio:2026-06-05:bio',
        date: '2026-06-05',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        tourName: 'Biotour',
        tourDescription: 'Regelabfuhr fuer die Innenstadt.',
        note: 'Zusatzleerung',
      },
      {
        id: 'tour-custom-preset:2026-06-08:rest',
        date: '2026-06-08',
        fractionId: 'rest',
        fractionLabel: 'Restmüll',
        fractionColor: '#444444',
        tourName: 'Ferientour',
        tourDescription: 'Abweichender Ferienrhythmus.',
        note: null,
      },
      {
        id: 'tour-bio:2026-06-17:bio',
        date: '2026-06-17',
        fractionId: 'bio',
        fractionLabel: 'Biotonne',
        fractionColor: '#00AA00',
        tourName: 'Biotour',
        tourDescription: 'Regelabfuhr fuer die Innenstadt.',
        note: null,
      },
    ]);
  });

  it('keeps occurrences whose original date is outside the requested window when a shift moves them into it', () => {
    const entries = calculatePublicWasteCalendarEntries({
      referenceDate: '2026-01-01',
      selection: {
        cityId: 'c-1',
        streetId: 's-1',
      },
      linkedTours: [
        {
          linkId: 'link-1',
          locationId: 'loc-1',
          startDate: '2025-01-01',
          endDate: '2026-12-31',
          tour: {
            id: 'tour-rest',
            name: 'Restmüll',
            recurrence: 'weekly',
            firstDate: '2025-12-31',
            endDate: '2025-12-31',
            fractions: [{ id: 'rest', label: 'Restmüll', color: '#444444' }],
          },
        },
      ],
      tourDateShifts: [
        {
          id: 'shift-tour-1',
          tourId: 'tour-rest',
          originalDate: '2025-12-31',
          actualDate: '2026-01-02',
          description: 'Verschoben nach Neujahr',
        },
      ],
      globalDateShifts: [],
    });

    expect(entries).toEqual([
      {
        id: 'tour-rest:2026-01-02:rest',
        date: '2026-01-02',
        fractionId: 'rest',
        fractionLabel: 'Restmüll',
        fractionColor: '#444444',
        tourName: 'Restmüll',
        note: 'Verschoben nach Neujahr',
      },
    ]);
  });

  it('includes past occurrences back to the start of the previous year', () => {
    const entries = calculatePublicWasteCalendarEntries({
      referenceDate: '2026-12-31',
      selection: {
        cityId: 'c-1',
        streetId: 's-1',
      },
      linkedTours: [
        {
          linkId: 'link-1',
          locationId: 'loc-1',
          startDate: '2025-01-01',
          endDate: '2026-12-31',
          tour: {
            id: 'tour-paper',
            name: 'Papiertour',
            recurrence: null,
            customDates: [{ date: '2025-01-08' }],
            fractions: [{ id: 'paper', label: 'Papier', color: '#0000FF' }],
          },
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [],
    });

    expect(entries).toEqual([
      {
        id: 'tour-paper:2025-01-08:paper',
        date: '2025-01-08',
        fractionId: 'paper',
        fractionLabel: 'Papier',
        fractionColor: '#0000FF',
        tourName: 'Papiertour',
        note: null,
      },
    ]);
  });

  it('applies configured holiday postponements to public calendar entries', () => {
    const entries = calculatePublicWasteCalendarEntries({
      referenceDate: '2026-01-01',
      selection: {
        cityId: 'c-1',
        streetId: 's-1',
      },
      linkedTours: [
        {
          linkId: 'link-1',
          locationId: 'loc-1',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          tour: {
            id: 'tour-rest',
            name: 'Restmüll',
            recurrence: 'weekly',
            firstDate: '2026-01-01',
            endDate: '2026-01-08',
            fractions: [{ id: 'rest', label: 'Restmüll', color: '#444444' }],
          },
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [
        {
          id: 'holiday-1',
          holidayDate: '2026-01-01',
          holidayName: 'Neujahr',
          year: 2026,
          stateCode: 'BB',
          sourceStatus: 'confirmed',
          configurationStatus: 'configured',
          conflictStatus: 'none',
          scope: 'holiday-only',
          strategy: 'postpone',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(entries).toEqual([
      {
        id: 'tour-rest:2026-01-02:rest',
        date: '2026-01-02',
        fractionId: 'rest',
        fractionLabel: 'Restmüll',
        fractionColor: '#444444',
        tourName: 'Restmüll',
        note: null,
      },
      {
        id: 'tour-rest:2026-01-08:rest',
        date: '2026-01-08',
        fractionId: 'rest',
        fractionLabel: 'Restmüll',
        fractionColor: '#444444',
        tourName: 'Restmüll',
        note: null,
      },
    ]);
  });
});
