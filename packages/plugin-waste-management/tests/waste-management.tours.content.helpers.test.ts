import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { describe, expect, it, vi } from 'vitest';

import { normalizeWasteManagementSearchParams } from '../src/search-params.js';
import { filterTours } from '../src/waste-management.tours.filter.js';
import {
  applyWasteToursFilters,
  createLocationCountByTourId,
  resetWasteToursFilters,
  sortWasteTours,
  updateWasteToursSorting,
} from '../src/waste-management.tours.content.helpers.js';

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  if (key === 'tours.meta.customRecurrenceLabel') {
    return `${variables?.name}:${variables?.days}`;
  }
  return key;
};

const createTour = (overrides: Partial<WasteTourRecord>): WasteTourRecord => ({
  id: 'tour-1',
  name: 'Tour',
  wasteFractionIds: [],
  status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('waste-management tours content helpers', () => {
  it('counts displayed locations for tours and skips unresolved records', () => {
    expect(createLocationCountByTourId(null)).toEqual(new Map());
    expect(
      createLocationCountByTourId({
        collectionLocations: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
        locationTourLinks: [
          { tourId: 'tour-1', locationId: 'one' },
          { tourId: 'tour-2', locationId: 'two' },
          { tourId: 'tour-1', locationId: 'three' },
          { tourId: 'tour-2', locationId: 'unavailable' },
        ],
      })
    ).toEqual(
      new Map([
        ['tour-1', 2],
        ['tour-2', 1],
      ])
    );
  });

  it('sorts tours by recurrence, first date, and location count in both directions', () => {
    const tours = [
      createTour({ id: 'tour-1', name: 'Alpha', recurrence: null, firstDate: '2026-02-10' }),
      createTour({
        id: 'tour-2',
        name: 'Beta',
        customRecurrenceName: 'Flex',
        customRecurrenceIntervalDays: 10,
        firstDate: '2026-01-05',
      }),
      createTour({ id: 'tour-3', name: 'Gamma', recurrence: 'weekly', firstDate: '2026-03-01' }),
    ];
    const locationCountByTourId = new Map<string, number>([
      ['tour-1', 4],
      ['tour-2', 1],
      ['tour-3', 9],
    ]);

    expect(
      sortWasteTours({
        tours,
        sortField: 'recurrence',
        sortDirection: 'asc',
        locationCountByTourId,
        pt,
      }).map((tour) => tour.id)
    ).toEqual(['tour-2', 'tour-3', 'tour-1']);

    expect(
      sortWasteTours({
        tours,
        sortField: 'dateRange',
        sortDirection: 'asc',
        locationCountByTourId,
        pt,
      }).map((tour) => tour.id)
    ).toEqual(['tour-2', 'tour-1', 'tour-3']);

    expect(
      sortWasteTours({
        tours,
        sortField: 'dateRange',
        sortDirection: 'desc',
        locationCountByTourId,
        pt,
      }).map((tour) => tour.id)
    ).toEqual(['tour-3', 'tour-1', 'tour-2']);

    expect(
      sortWasteTours({
        tours,
        sortField: 'locations',
        sortDirection: 'desc',
        locationCountByTourId,
        pt,
      }).map((tour) => tour.id)
    ).toEqual(['tour-3', 'tour-1', 'tour-2']);
  });

  it('combines the review criterion with publication status', () => {
    const tours = [
      createTour({ id: 'reviewed-published', reviewedOn: '2026-11-26' }),
      createTour({ id: 'reviewed-draft', status: 'draft', reviewedOn: '2026-11-28' }),
      createTour({ id: 'unreviewed' }),
    ];
    const search = normalizeWasteManagementSearchParams({
      tab: 'tours',
      tourStatus: 'published',
      tourReview: 'reviewed',
    });
    expect(filterTours(tours, search).map(({ id }) => id)).toEqual(['reviewed-published']);
    expect(filterTours(tours, { ...search, tourReview: 'unreviewed' }).map(({ id }) => id)).toEqual(
      ['unreviewed']
    );
    expect(filterTours(tours, { ...search, tourReview: undefined }).map(({ id }) => id)).toEqual([
      'reviewed-published',
      'unreviewed',
    ]);
  });

  it('sorts review dates in both directions with unreviewed tours last', () => {
    const tours = [
      createTour({ id: 'unreviewed' }),
      createTour({ id: 'latest', reviewedOn: '2026-12-02' }),
      createTour({ id: 'earliest', reviewedOn: '2026-11-28' }),
    ];
    const options = {
      tours,
      sortField: 'reviewedOn' as const,
      locationCountByTourId: new Map(),
      pt,
    };

    expect(sortWasteTours({ ...options, sortDirection: 'asc' }).map(({ id }) => id)).toEqual([
      'earliest',
      'latest',
      'unreviewed',
    ]);
    expect(sortWasteTours({ ...options, sortDirection: 'desc' }).map(({ id }) => id)).toEqual([
      'latest',
      'earliest',
      'unreviewed',
    ]);
  });

  it('returns the original tour array when no sort field is active', () => {
    const tours = [createTour({ id: 'tour-1' }), createTour({ id: 'tour-2' })];

    expect(
      sortWasteTours({
        tours,
        sortField: null,
        sortDirection: 'asc',
        locationCountByTourId: new Map(),
        pt,
      })
    ).toBe(tours);
  });

  it('applies draft tour filters through the aggregated callback when available', () => {
    const onFiltersChange = vi.fn();
    const onQueryChange = vi.fn();
    const onStatusChange = vi.fn();
    const setFilterDialogOpen = vi.fn();

    applyWasteToursFilters({
      onFiltersChange,
      onQueryChange,
      onStatusChange,
      setFilterDialogOpen,
      draftQuery: 'Bio',
      draftStatus: 'draft',
      draftTourValidityPeriod: 'current',
      draftTourReview: 'reviewed',
      draftTourWasteFractionId: 'fraction-1',
      draftFirstDateFrom: '2026-01-01',
      draftFirstDateTo: '2026-01-31',
      draftEndDateFrom: '2026-12-01',
      draftEndDateTo: '2026-12-31',
    });

    expect(onFiltersChange).toHaveBeenCalledWith(
      'Bio',
      'draft',
      'current',
      'fraction-1',
      '2026-01-01',
      '2026-01-31',
      '2026-12-01',
      '2026-12-31',
      'reviewed'
    );
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(setFilterDialogOpen).toHaveBeenCalledWith(false);
  });

  it('falls back to query and status callbacks when aggregated tour filters are unavailable', () => {
    const onQueryChange = vi.fn();
    const onStatusChange = vi.fn();
    const setFilterDialogOpen = vi.fn();

    applyWasteToursFilters({
      onFiltersChange: undefined,
      onQueryChange,
      onStatusChange,
      setFilterDialogOpen,
      draftQuery: 'Papier',
      draftStatus: 'published',
      draftTourValidityPeriod: 'all',
      draftTourWasteFractionId: undefined,
      draftFirstDateFrom: undefined,
      draftFirstDateTo: undefined,
      draftEndDateFrom: undefined,
      draftEndDateTo: undefined,
    });

    expect(onQueryChange).toHaveBeenCalledWith('Papier');
    expect(onStatusChange).toHaveBeenCalledWith('published');
    expect(setFilterDialogOpen).toHaveBeenCalledWith(false);
  });

  it('resets filters through either the aggregated callback or the basic query and status callbacks', () => {
    const onFiltersChange = vi.fn();
    const onQueryChange = vi.fn();
    const onStatusChange = vi.fn();

    resetWasteToursFilters({ onFiltersChange, onQueryChange, onStatusChange });
    expect(onFiltersChange).toHaveBeenCalledWith(
      '',
      'all',
      'all',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    resetWasteToursFilters({
      onFiltersChange: undefined,
      onQueryChange,
      onStatusChange,
    });
    expect(onQueryChange).toHaveBeenCalledWith('');
    expect(onStatusChange).toHaveBeenCalledWith('all');
  });

  it('toggles sorting direction for the active field and resets new fields to ascending', () => {
    const setSortField = vi.fn();
    const setSortDirection = vi.fn();

    updateWasteToursSorting({
      field: 'name',
      sortField: 'name',
      setSortField,
      setSortDirection,
    });
    expect(setSortField).not.toHaveBeenCalled();
    expect(setSortDirection).toHaveBeenCalledWith(expect.any(Function));
    expect(setSortDirection.mock.calls[0]?.[0]('asc')).toBe('desc');
    expect(setSortDirection.mock.calls[0]?.[0]('desc')).toBe('asc');

    setSortDirection.mockReset();

    updateWasteToursSorting({
      field: 'status',
      sortField: 'name',
      setSortField,
      setSortDirection,
    });
    expect(setSortField).toHaveBeenCalledWith('status');
    expect(setSortDirection).toHaveBeenCalledWith('asc');
  });
});
