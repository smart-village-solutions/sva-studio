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
    expect(pickupDates).not.toEqual(expect.arrayContaining([expect.objectContaining({ pickupDate: '2026-01-06' })]));
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
          reminderCount: 'none',
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
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
});
