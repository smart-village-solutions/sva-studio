import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDefaultLocationTourLinkForm,
  createDefaultTourForm,
  filterTours,
  mapLocationTourLinkToForm,
  mapTourToForm,
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
      startDate: '',
      endDate: '',
    });

    expect(createDefaultTourForm()).toEqual({
      id: 'tour-default-id',
      name: '',
      description: '',
      wasteFractionIds: [],
      recurrence: 'custom',
      firstDate: '',
      endDate: '',
      customDates: [],
      active: true,
    });
  });

  it('maps records into form state and normalizes optional values', () => {
    expect(
      mapLocationTourLinkToForm({
        id: 'link-1',
        locationId: 'location-1',
        tourId: 'tour-1',
        startDate: null,
        endDate: undefined,
      } as never)
    ).toEqual({
      id: 'link-1',
      locationId: 'location-1',
      tourId: 'tour-1',
      startDate: '',
      endDate: '',
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
      firstDate: '',
      endDate: '',
      customDates: [
        { date: '2026-05-01', description: 'Feiertag' },
        { date: '2026-06-01', description: '' },
      ],
      active: false,
    });
  });

  it('builds create and update payloads with compact optional strings and parsed custom dates', () => {
    expect(
      toCreateLocationTourLinkInput({
        id: 'link-2',
        locationId: 'location-2',
        tourId: 'tour-2',
        startDate: ' 2026-01-01 ',
        endDate: '   ',
      })
    ).toEqual({
      id: 'link-2',
      locationId: 'location-2',
      tourId: 'tour-2',
      startDate: '2026-01-01',
      endDate: undefined,
    });

    expect(
      toUpdateLocationTourLinkInput({
        id: 'ignored',
        locationId: 'location-3',
        tourId: 'tour-3',
        startDate: '',
        endDate: '2026-12-31',
      })
    ).toEqual({
      locationId: 'location-3',
      tourId: 'tour-3',
      startDate: undefined,
      endDate: '2026-12-31',
    });

    const form = {
      id: 'tour-2',
      name: '  Biomüll Mitte  ',
      description: '  werktags  ',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      recurrence: 'custom',
      firstDate: ' 2026-01-02 ',
      endDate: ' ',
      customDates: [
        { date: '2026-05-01', description: 'Tag der Arbeit' },
        { date: '2026-06-01', description: 'mit | pipe' },
      ],
      active: true,
    } as const;

    expect(toCreateTourInput(form)).toEqual({
      id: 'tour-2',
      name: 'Biomüll Mitte',
      description: 'werktags',
      wasteFractionIds: ['fraction-1', 'fraction-2'],
      recurrence: 'custom',
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
      firstDate: '2026-01-02',
      endDate: undefined,
      customDates: undefined,
      active: true,
    });
  });

  it('filters tours by id, status, fraction, and case-insensitive search', () => {
    const tours = [
      {
        id: 'tour-active',
        name: 'Restmüll Nord',
        description: 'Montag',
        wasteFractionIds: ['fraction-1'],
        active: true,
      },
      {
        id: 'tour-inactive',
        name: 'Papier West',
        description: 'Dienstag',
        wasteFractionIds: ['fraction-2'],
        active: false,
      },
      {
        id: 'tour-unknown',
        name: 'Bio Süd',
        description: '',
        wasteFractionIds: ['fraction-1', 'fraction-3'],
        active: undefined,
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
        wasteFractionId: 'fraction-2',
      } as never).map((tour) => tour.id)
    ).toEqual(['tour-inactive']);

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
});
