import { describe, expect, it } from 'vitest';
import type { WasteTourDateShiftFollowUpMode, WasteTourRecord } from '@sva/core';

import {
  buildMaterializedLocationTourPickupDates,
  buildStudioRowsFromMaterialization,
} from './waste-management-mainserver-sync.materialization.js';

const buildTour = (override: Partial<WasteTourRecord> = {}): WasteTourRecord =>
  ({
    id: 'tour-1',
    name: 'Testtour',
    wasteFractionIds: ['fraction-1'],
    recurrence: 'on-demand',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...override,
  }) as unknown as WasteTourRecord;

describe('waste-management-mainserver-sync.materialization', () => {
  it('materializes explicit assignments without a general location-tour link', () => {
    const result = buildMaterializedLocationTourPickupDates({
      tours: [
        {
          id: 'tour-1',
          name: 'Schadstoffmobil',
          wasteFractionIds: ['fraction-1'],
          recurrence: null,
          active: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      links: [],
      locationTourPickupDates: [],
      tourAssignments: [
        {
          id: 'assignment-1',
          tourId: 'tour-1',
          pickupDate: '2026-06-10',
          note: '14–16 Uhr',
          locationIds: ['location-1', 'location-2'],
          createdAt: '',
          updatedAt: '',
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(result).toEqual([
      expect.objectContaining({
        locationId: 'location-1',
        tourId: 'tour-1',
        pickupDate: '2026-06-10',
        note: '14–16 Uhr',
      }),
      expect.objectContaining({
        locationId: 'location-2',
        tourId: 'tour-1',
        pickupDate: '2026-06-10',
        note: '14–16 Uhr',
      }),
    ]);
  });

  it('preserves multiple explicit assignments for the same tour, date, and location', () => {
    const result = buildMaterializedLocationTourPickupDates({
      tours: [buildTour()],
      links: [],
      locationTourPickupDates: [],
      tourAssignments: [
        {
          id: 'assignment-1',
          tourId: 'tour-1',
          pickupDate: '2026-06-10',
          note: 'Vormittags',
          locationIds: ['location-1'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'assignment-2',
          tourId: 'tour-1',
          pickupDate: '2026-06-10',
          note: 'Nachmittags',
          locationIds: ['location-1'],
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.note)).toEqual(['Vormittags', 'Nachmittags']);
  });

  it('applies single pickup shift to exactly one original date', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          customDates: [{ date: '2026-01-06' }, { date: '2026-01-13' }],
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      tourDateShifts: [
        {
          id: 'shift-1',
          tourId: 'tour-1',
          originalDate: '2026-01-06',
          actualDate: '2026-01-05',
          hasYear: true,
          followUpMode: 'none' as WasteTourDateShiftFollowUpMode,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pickupDate: '2026-01-05' }),
        expect.objectContaining({ pickupDate: '2026-01-13' }),
      ])
    );
    expect(pickupDates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ pickupDate: '2026-01-06' })])
    );
  });

  it('applies rest-of-week advance shifts for Monday shift fallback to Saturday', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          customDates: [{ date: '2026-01-26' }, { date: '2026-01-27' }, { date: '2026-01-28' }],
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      tourDateShifts: [
        {
          id: 'shift-2',
          tourId: 'tour-1',
          originalDate: '2026-01-27',
          actualDate: '2026-01-26',
          hasYear: true,
          followUpMode: 'propagate-series' as WasteTourDateShiftFollowUpMode,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates.map((entry) => entry.pickupDate)).toEqual(
      expect.arrayContaining(['2026-01-24', '2026-01-26', '2026-01-28'])
    );
  });

  it('maps materialized dates to synchronized row entries', () => {
    const rows = buildStudioRowsFromMaterialization({
      pickupDates: [
        {
          id: 'materialized-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          pickupDate: '2026-01-05',
          note: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tours: [buildTour()],
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: {
              push: false,
              email: false,
              calendar: false,
            },
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locations: [
        {
          id: 'location-1',
          cityId: 'city-1',
          streetId: 'street-1',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterhausen',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          cityId: 'city-1',
          name: 'Hauptstraße',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        pickupDate: '2026-01-05',
        wasteType: 'Restmüll',
        street: 'Hauptstraße',
        city: 'Musterhausen',
      })
    );
  });

  it('skips inactive or unresolved collection locations during sync materialization', () => {
    const rows = buildStudioRowsFromMaterialization({
      pickupDates: [
        {
          id: 'materialized-1',
          locationId: 'location-inactive',
          tourId: 'tour-1',
          pickupDate: '2026-01-05',
          note: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'materialized-2',
          locationId: 'location-without-street',
          tourId: 'tour-1',
          pickupDate: '2026-01-06',
          note: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tours: [buildTour()],
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: {
              push: false,
              email: false,
              calendar: false,
            },
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-inactive',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-2',
          locationId: 'location-without-street',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locations: [
        {
          id: 'location-inactive',
          cityId: 'city-1',
          streetId: 'street-1',
          active: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'location-without-street',
          cityId: 'city-1',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterhausen',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          cityId: 'city-1',
          name: 'Hauptstraße',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(rows).toEqual([]);
  });

  it('expands yearless shifts and preserves calendar dates for yearly recurrences', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          recurrence: 'yearly',
          firstDate: '2024-01-01',
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      tourDateShifts: [
        {
          id: 'shift-1',
          tourId: 'tour-1',
          originalDate: '2026-01-01',
          actualDate: '2026-01-02',
          hasYear: false,
          followUpMode: 'none' as WasteTourDateShiftFollowUpMode,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates.map((entry) => entry.pickupDate)).toEqual(['2026-01-02', '2027-01-02']);
    expect(pickupDates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pickupDate: '2026-12-31' }),
        expect.objectContaining({ pickupDate: '2027-01-01' }),
      ])
    );
  });

  it('prefers tour-specific shifts over global shifts for the same original date', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          customDates: [{ date: '2026-05-05' }],
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      tourDateShifts: [
        {
          id: 'tour-shift-1',
          tourId: 'tour-1',
          originalDate: '2026-05-05',
          actualDate: '2026-05-07',
          hasYear: true,
          followUpMode: 'none' as WasteTourDateShiftFollowUpMode,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [
        {
          id: 'global-shift-1',
          originalDate: '2026-05-05',
          actualDate: '2026-05-06',
          hasYear: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates.map((entry) => entry.pickupDate)).toEqual(['2026-05-07']);
  });

  it('keeps shifts whose actual date lands inside the synchronized year window', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          customDates: [{ date: '2025-12-31' }],
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      tourDateShifts: [
        {
          id: 'shift-1',
          tourId: 'tour-1',
          originalDate: '2025-12-31',
          actualDate: '2026-01-02',
          hasYear: true,
          followUpMode: 'none' as WasteTourDateShiftFollowUpMode,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates.map((entry) => entry.pickupDate)).toEqual(['2026-01-02']);
  });

  it('preserves imported pickup-date notes through materialization and shifting', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [buildTour()],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [
        {
          id: 'pickup-imported-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          pickupDate: '2026-01-06',
          note: 'Schnee-Ersatztermin',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [
        {
          id: 'shift-1',
          tourId: 'tour-1',
          originalDate: '2026-01-06',
          actualDate: '2026-01-05',
          hasYear: true,
          followUpMode: 'none' as WasteTourDateShiftFollowUpMode,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates).toEqual([
      expect.objectContaining({
        pickupDate: '2026-01-05',
        note: 'Schnee-Ersatztermin',
      }),
    ]);
  });

  it('skips links when no dates survive the initial range filter and deduplicates duplicate output rows', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          customDates: [{ date: '2026-02-10' }],
        }),
        buildTour({
          id: 'tour-2',
          customDates: [{ date: '2026-03-01' }],
        }),
      ],
      links: [
        {
          id: 'link-out-of-range',
          locationId: 'location-9',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-duplicate-a',
          locationId: 'location-2',
          tourId: 'tour-2',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-duplicate-b',
          locationId: 'location-2',
          tourId: 'tour-2',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates).toEqual([
      expect.objectContaining({
        locationId: 'location-2',
        tourId: 'tour-2',
        pickupDate: '2026-03-01',
      }),
    ]);
  });

  it('stops processing a link when a shift moves the remaining date out of the link range', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          customDates: [{ date: '2026-04-15' }],
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [],
      tourDateShifts: [
        {
          id: 'shift-1',
          tourId: 'tour-1',
          originalDate: '2026-04-15',
          actualDate: '2026-04-16',
          hasYear: true,
          followUpMode: 'none' as WasteTourDateShiftFollowUpMode,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      globalDateShifts: [],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates).toEqual([]);
  });

  it('applies global shifts only to matching tours and prefers imported notes when dates are deduplicated', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          id: 'tour-1',
          customDates: [{ date: '2026-05-05' }],
        }),
        buildTour({
          id: 'tour-2',
          customDates: [{ date: '2026-05-05' }],
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-2',
          locationId: 'location-1',
          tourId: 'tour-2',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [
        {
          id: 'pickup-imported-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          pickupDate: '2026-05-05',
          note: 'Importierter Hinweis',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [
        {
          id: 'global-shift-1',
          originalDate: '2026-05-05',
          actualDate: '2026-05-06',
          hasYear: true,
          tourIds: ['tour-1'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      holidayRules: [],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates).toEqual([
      expect.objectContaining({
        locationId: 'location-1',
        tourId: 'tour-1',
        pickupDate: '2026-05-06',
        note: 'Importierter Hinweis',
      }),
      expect.objectContaining({
        locationId: 'location-1',
        tourId: 'tour-2',
        pickupDate: '2026-05-05',
        note: null,
      }),
    ]);
  });

  it('applies configured holiday rules and skips invalid scheduling records outside the sync window', () => {
    const pickupDates = buildMaterializedLocationTourPickupDates({
      tours: [
        buildTour({
          customDates: [{ date: '2026-12-25' }],
        }),
        buildTour({
          id: 'tour-inactive',
          active: false,
          customDates: [{ date: '2026-06-01' }],
        }),
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-2',
          locationId: 'location-1',
          tourId: 'tour-inactive',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [
        {
          id: 'pickup-imported-old',
          locationId: 'location-1',
          tourId: 'tour-1',
          pickupDate: '2024-12-31',
          note: 'Zu alt',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'pickup-imported-invalid',
          locationId: 'location-1',
          tourId: 'tour-1',
          pickupDate: 'invalid-date',
          note: 'Ungültig',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [],
      globalDateShifts: [],
      holidayRules: [
        {
          id: 'holiday-1',
          holidayDate: '2026-12-25',
          holidayName: 'Weihnachten',
          year: 2026,
          stateCode: 'BB',
          sourceStatus: 'confirmed',
          configurationStatus: 'configured',
          conflictStatus: 'none',
          scope: 'holiday-only',
          strategy: 'advance',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'holiday-2',
          holidayDate: '',
          holidayName: 'Ignorieren',
          year: 2026,
          stateCode: 'BB',
          sourceStatus: 'confirmed',
          configurationStatus: 'configured',
          conflictStatus: 'none',
          scope: 'full-week',
          strategy: 'advance',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      currentYear: 2026,
      nextYear: 2027,
    });

    expect(pickupDates).toEqual([
      expect.objectContaining({
        tourId: 'tour-1',
        pickupDate: '2026-12-24',
      }),
    ]);
  });

  it('ignores holiday rules with non-string holiday dates instead of throwing', () => {
    expect(() =>
      buildMaterializedLocationTourPickupDates({
        tours: [
          buildTour({
            customDates: [{ date: '2026-12-25' }],
          }),
        ],
        links: [
          {
            id: 'link-1',
            locationId: 'location-1',
            tourId: 'tour-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        locationTourPickupDates: [],
        tourDateShifts: [],
        globalDateShifts: [],
        holidayRules: [
          {
            id: 'holiday-invalid-date',
            holidayDate: new Date('2026-12-24T00:00:00.000Z') as unknown as string,
            holidayName: 'Fehlerhafte Altlast',
            year: 2026,
            stateCode: 'BB',
            sourceStatus: 'confirmed',
            configurationStatus: 'configured',
            conflictStatus: 'none',
            scope: 'holiday-only',
            strategy: 'advance',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'holiday-valid',
            holidayDate: '2026-12-25',
            holidayName: 'Weihnachten',
            year: 2026,
            stateCode: 'BB',
            sourceStatus: 'confirmed',
            configurationStatus: 'configured',
            conflictStatus: 'none',
            scope: 'holiday-only',
            strategy: 'advance',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        currentYear: 2026,
        nextYear: 2027,
      })
    ).not.toThrow();
  });

  it('preserves notes but skips rows without resolved city, street, or waste type during row projection', () => {
    const rows = buildStudioRowsFromMaterialization({
      pickupDates: [
        {
          id: 'materialized-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          pickupDate: '2026-01-05',
          note: 'Schnee-Ersatztermin',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'materialized-2',
          locationId: 'location-missing-city',
          tourId: 'tour-1',
          pickupDate: '2026-01-06',
          note: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tours: [
        buildTour({
          wasteFractionIds: ['fraction-1', 'fraction-blank'],
        }),
      ],
      fractions: [
        {
          id: 'fraction-1',
          name: 'Restmüll',
          color: '#111',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: {
              push: false,
              email: false,
              calendar: false,
            },
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'fraction-blank',
          name: '   ',
          color: '#222',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: {
              push: false,
              email: false,
              calendar: false,
            },
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      links: [
        {
          id: 'link-1',
          locationId: 'location-1',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-2',
          locationId: 'location-missing-city',
          tourId: 'tour-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locations: [
        {
          id: 'location-1',
          cityId: 'city-1',
          streetId: 'street-1',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'location-missing-city',
          cityId: 'city-missing',
          streetId: 'street-1',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      cities: [
        {
          id: 'city-1',
          name: 'Musterhausen',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      streets: [
        {
          id: 'street-1',
          cityId: 'city-1',
          name: 'Hauptstraße',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        pickupDate: '2026-01-05',
        wasteType: 'Restmüll',
        note: 'Schnee-Ersatztermin',
        key: '2026-01-05::restmüll::hauptstraße::musterhausen',
      }),
    ]);
  });
});
