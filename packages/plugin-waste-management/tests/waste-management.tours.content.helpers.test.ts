import type { WasteTourRecord } from '@sva/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';

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
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('waste-management tours content helpers', () => {
  it('counts locations per tour id and treats missing links as empty', () => {
    expect(createLocationCountByTourId(undefined)).toEqual(new Map());
    expect(
      createLocationCountByTourId([
        { tourId: 'tour-1' },
        { tourId: 'tour-2' },
        { tourId: 'tour-1' },
      ])
    ).toEqual(
      new Map([
        ['tour-1', 2],
        ['tour-2', 1],
      ])
    );
  });

  it('sorts tours by recurrence and location count in both directions', () => {
    const tours = [
      createTour({ id: 'tour-1', name: 'Alpha', recurrence: null }),
      createTour({ id: 'tour-2', name: 'Beta', customRecurrenceName: 'Flex', customRecurrenceIntervalDays: 10 }),
      createTour({ id: 'tour-3', name: 'Gamma', recurrence: 'weekly' }),
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
    ).toEqual(['tour-1', 'tour-2', 'tour-3']);

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
      draftStatus: 'inactive',
      draftTourWasteFractionId: 'fraction-1',
      draftFirstDateFrom: '2026-01-01',
      draftFirstDateTo: '2026-01-31',
      draftEndDateFrom: '2026-12-01',
      draftEndDateTo: '2026-12-31',
    });

    expect(onFiltersChange).toHaveBeenCalledWith(
      'Bio',
      'inactive',
      'fraction-1',
      '2026-01-01',
      '2026-01-31',
      '2026-12-01',
      '2026-12-31'
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
      draftStatus: 'active',
      draftTourWasteFractionId: undefined,
      draftFirstDateFrom: undefined,
      draftFirstDateTo: undefined,
      draftEndDateFrom: undefined,
      draftEndDateTo: undefined,
    });

    expect(onQueryChange).toHaveBeenCalledWith('Papier');
    expect(onStatusChange).toHaveBeenCalledWith('active');
    expect(setFilterDialogOpen).toHaveBeenCalledWith(false);
  });

  it('resets filters through either the aggregated callback or the basic query and status callbacks', () => {
    const onFiltersChange = vi.fn();
    const onQueryChange = vi.fn();
    const onStatusChange = vi.fn();

    resetWasteToursFilters({ onFiltersChange, onQueryChange, onStatusChange });
    expect(onFiltersChange).toHaveBeenCalledWith('', 'all', undefined, undefined, undefined, undefined, undefined);

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
