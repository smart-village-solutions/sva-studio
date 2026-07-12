import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTourDateLocationAssignmentKey,
  createDefaultLocationTourLinkForm,
  createDefaultTourForm,
  filterTours,
  mapLocationTourLinkToForm,
  mapPickupDatesToTourDateLocationAssignments,
  mapTourToForm,
  normalizeTourDateLocationAssignments,
  removeAssignmentsForDeletedDates,
  resolveActiveTourFractions,
  toCreateLocationTourLinkInput,
  toCreateTourInput,
  toUpdateLocationTourLinkInput,
  toUpdateTourInput,
} from '../src/waste-management.tours.shared.js';

describe('waste-management.tours.shared', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('link-default-id')
        .mockReturnValueOnce('tour-default-id'),
    });
  });

  it('creates empty default form states with generated ids', () => {
    expect(createDefaultLocationTourLinkForm()).toEqual({
      id: 'link-default-id',
      locationId: '',
      tourId: '',
    });

    expect(createDefaultTourForm()).toEqual({
      id: 'tour-default-id',
      name: '',
      description: '',
      wasteFractionIds: [],
      recurrence: 'custom',
      customRecurrenceId: '',
      firstDate: '',
      endDate: '',
      customDates: [],
      dateLocationAssignments: [],
      active: true,
    });
  });

  it('maps records into form state and normalizes optional values', () => {
    expect(
      mapLocationTourLinkToForm({
        id: 'link-1',
        locationId: 'location-1',
        tourId: 'tour-1',
      } as never)
    ).toEqual({
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
    });

    expect(
      mapTourToForm({
        id: 'tour-1',
        name: 'Restmüll',
        description: null,
        wasteFractionIds: ['fraction-1'],
        recurrence: null,
        firstDate: null,
        endDate: undefined,
        customDates: [
          { date: '2026-05-01', description: 'Feiertag' },
          { date: '2026-06-01', description: '' },
        ],
        active: false,
      } as never)
    ).toEqual({
      id: 'tour-1',
      name: 'Restmüll',
      description: '',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'custom',
      customRecurrenceId: '',
      firstDate: '',
      endDate: '',
      customDates: [
        { date: '2026-05-01', description: 'Feiertag' },
        { date: '2026-06-01', description: '' },
      ],
      dateLocationAssignments: [],
      active: false,
    });

    expect(
      mapTourToForm({
        id: 'tour-2',
        name: 'Ferien',
        description: '',
        wasteFractionIds: ['fraction-1'],
        recurrence: null,
        customRecurrenceId: 'preset-1',
        firstDate: '2026-01-01',
        endDate: '2026-02-01',
        customDates: [],
        active: true,
      } as never)
    ).toEqual({
      id: 'tour-2',
      name: 'Ferien',
      description: '',
      wasteFractionIds: ['fraction-1'],
      recurrence: '',
      customRecurrenceId: 'preset-1',
      firstDate: '2026-01-01',
      endDate: '2026-02-01',
      customDates: [],
      dateLocationAssignments: [],
      active: true,
    });
  });

  it('builds create and update payloads with compact optional strings and parsed custom dates', () => {
    expect(
      toCreateLocationTourLinkInput({
        id: 'link-2',
        locationId: 'location-2',
        tourId: 'tour-2',
      })
    ).toEqual({
      id: 'link-2',
      locationId: 'location-2',
      tourId: 'tour-2',
    });

    expect(
      toUpdateLocationTourLinkInput({
        id: 'ignored',
        locationId: 'location-3',
        tourId: 'tour-3',
      })
    ).toEqual({
      locationId: 'location-3',
      tourId: 'tour-3',
    });

    const form = {
      id: 'tour-2',
      name: '  Biomüll Mitte  ',
      description: '  werktags  ',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      recurrence: 'custom',
      customRecurrenceId: '',
      firstDate: ' 2026-01-02 ',
      endDate: ' ',
      customDates: [
        { date: '2026-05-01', description: 'Tag der Arbeit' },
        { date: '2026-06-01', description: 'mit | pipe' },
      ],
      dateLocationAssignments: [],
      active: true,
    } as const;

    expect(toCreateTourInput(form)).toEqual({
      id: 'tour-2',
      name: 'Biomüll Mitte',
      description: 'werktags',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      recurrence: 'custom',
      customRecurrenceId: undefined,
      firstDate: undefined,
      endDate: undefined,
      customDates: [
        { date: '2026-05-01', description: 'Tag der Arbeit' },
        { date: '2026-06-01', description: 'mit | pipe' },
      ],
      active: true,
    });

    expect(
      toUpdateTourInput({
        ...form,
        recurrence: 'weekly',
        customDates: [],
      })
    ).toEqual({
      name: 'Biomüll Mitte',
      description: 'werktags',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      recurrence: 'weekly',
      customRecurrenceId: undefined,
      firstDate: '2026-01-02',
      endDate: undefined,
      customDates: undefined,
      active: true,
    });

    expect(
      toCreateTourInput({
        ...form,
        recurrence: '',
        customRecurrenceId: 'preset-1',
        firstDate: '2026-01-02',
        endDate: '2026-02-01',
        customDates: [{ date: '2026-05-01', description: 'ignored' }],
      })
    ).toEqual({
      id: 'tour-2',
      name: 'Biomüll Mitte',
      description: 'werktags',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      recurrence: undefined,
      customRecurrenceId: 'preset-1',
      firstDate: '2026-01-02',
      endDate: '2026-02-01',
      customDates: undefined,
      active: true,
    });
  });

  it('maps and normalizes date-location assignments for a tour', () => {
    expect(
      mapPickupDatesToTourDateLocationAssignments(
        [
          {
            id: 'pickup-2',
            tourId: 'tour-1',
            locationId: 'location-2',
            pickupDate: '2026-06-02',
            note: null,
          },
          {
            id: 'pickup-1',
            tourId: 'tour-1',
            locationId: 'location-1',
            pickupDate: '2026-06-01',
            note: ' Rathaus ',
          },
          {
            id: 'pickup-3',
            tourId: 'tour-2',
            locationId: 'location-1',
            pickupDate: '2026-06-01',
            note: 'anderer Tour',
          },
        ] as never,
        'tour-1'
      )
    ).toEqual([
      {
        id: 'pickup-1',
        pickupDate: '2026-06-01',
        locationId: 'location-1',
        note: ' Rathaus ',
      },
      {
        id: 'pickup-2',
        pickupDate: '2026-06-02',
        locationId: 'location-2',
        note: '',
      },
    ]);

    expect(
      normalizeTourDateLocationAssignments([
        {
          id: 'pickup-2',
          pickupDate: ' 2026-06-02 ',
          locationId: ' location-2 ',
          note: '  Hinweis  ',
        },
        {
          id: 'pickup-1',
          pickupDate: '2026-06-01',
          locationId: 'location-1',
          note: '  ',
        },
        {
          id: 'pickup-overwrite',
          pickupDate: '2026-06-02',
          locationId: 'location-2',
          note: 'neu',
        },
        {
          id: 'ignored',
          pickupDate: '',
          locationId: 'location-3',
          note: 'leer',
        },
      ])
    ).toEqual([
      {
        id: 'pickup-1',
        pickupDate: '2026-06-01',
        locationId: 'location-1',
        note: '',
      },
      {
        id: 'pickup-overwrite',
        pickupDate: '2026-06-02',
        locationId: 'location-2',
        note: 'neu',
      },
    ]);

    expect(
      removeAssignmentsForDeletedDates(
        [
          {
            id: 'pickup-1',
            pickupDate: '2026-06-01',
            locationId: 'location-1',
            note: '',
          },
          {
            id: 'pickup-2',
            pickupDate: '2026-06-02',
            locationId: 'location-2',
            note: 'Hinweis',
          },
        ],
        [{ date: '2026-06-02' }]
      )
    ).toEqual([
      {
        id: 'pickup-2',
        pickupDate: '2026-06-02',
        locationId: 'location-2',
        note: 'Hinweis',
      },
    ]);

    expect(
      createTourDateLocationAssignmentKey({
        pickupDate: '2026-06-02',
        locationId: 'location-2',
      })
    ).toBe('2026-06-02::location-2');
  });

  it('filters tours by id, status, fraction, and case-insensitive search', () => {
    const tours = [
      {
        id: 'tour-active',
        name: 'Restmüll Nord',
        description: 'Montag',
        wasteFractionIds: ['fraction-1'],
        active: true,
        firstDate: '2026-01-10',
        endDate: '2026-12-20',
      },
      {
        id: 'tour-inactive',
        name: 'Papier West',
        description: 'Dienstag',
        wasteFractionIds: ['fraction-2'],
        active: false,
        firstDate: '2026-03-01',
        endDate: '2026-09-30',
      },
      {
        id: 'tour-unknown',
        name: 'Bio Süd',
        description: '',
        wasteFractionIds: ['fraction-1', 'fraction-3'],
        active: undefined,
        firstDate: undefined,
        endDate: undefined,
      },
    ] as never;

    expect(
      filterTours(tours, {
        tab: 'tours',
        q: '',
        page: 1,
        pageSize: 25,
        status: 'active',
      } as never).map((tour) => tour.id)
    ).toEqual(['tour-active', 'tour-unknown']);

    expect(
      filterTours(tours, {
        tab: 'tours',
        q: '',
        page: 1,
        pageSize: 25,
        status: 'inactive',
        tourWasteFractionId: 'fraction-2',
      } as never).map((tour) => tour.id)
    ).toEqual(['tour-inactive']);

    expect(
      filterTours(tours, {
        tab: 'tours',
        q: '',
        page: 1,
        pageSize: 25,
        status: 'all',
        firstDateFrom: '2026-02-01',
        firstDateTo: '2026-03-31',
        endDateFrom: '2026-09-01',
        endDateTo: '2026-10-31',
      } as never).map((tour) => tour.id)
    ).toEqual(['tour-inactive']);

    expect(
      filterTours(tours, {
        tab: 'tours',
        q: '',
        page: 1,
        pageSize: 25,
        status: 'all',
        firstDateFrom: '2026-01-10',
        firstDateTo: '2026-01-31',
        endDateTo: '2026-12-20',
      } as never).map((tour) => tour.id)
    ).toEqual(['tour-active']);

    expect(
      filterTours(tours, {
        tab: 'tours',
        q: 'mont',
        page: 1,
        pageSize: 25,
        status: 'all',
      } as never).map((tour) => tour.id)
    ).toEqual(['tour-active']);

    expect(
      filterTours(tours, {
        tab: 'tours',
        q: 'papier',
        page: 1,
        pageSize: 25,
        status: 'all',
        tourId: 'tour-inactive',
      } as never).map((tour) => tour.id)
    ).toEqual(['tour-inactive']);
  });

  it('resolves active fractions by matching ids only', () => {
    expect(
      resolveActiveTourFractions(
        [
          { id: 'fraction-1', name: 'Rest' },
          { id: 'fraction-2', name: 'Papier' },
          { id: 'fraction-3', name: 'Bio' },
        ] as never,
        ['fraction-2', 'fraction-3']
      )
    ).toEqual([
      { id: 'fraction-2', name: 'Papier' },
      { id: 'fraction-3', name: 'Bio' },
    ]);
  });

  it('includes duplicateFromTourId in create tour input mapping when present', () => {
    const form = {
      ...createDefaultTourForm(),
      id: 'tour-copy-1',
      name: 'Bio Nord (Kopie)',
      wasteFractionIds: ['fraction-1'],
    } as const;

    expect(toCreateTourInput(form, 'tour-source-1')).toMatchObject({
      id: 'tour-copy-1',
      name: 'Bio Nord (Kopie)',
      wasteFractionIds: ['fraction-1'],
      duplicateFromTourId: 'tour-source-1',
    });
  });
});
