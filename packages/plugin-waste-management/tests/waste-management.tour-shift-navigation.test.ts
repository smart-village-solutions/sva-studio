import { describe, expect, it } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import {
  clearTourShiftCreateContext,
  resolveTourShiftCreatePrefill,
  toCreateTourShiftSearch,
} from '../src/waste-management.tour-shift-navigation.js';

const search: WasteManagementSearchParams = {
  tab: 'tours',
  masterDataTab: 'locations',
  fractionsView: 'edit',
  toursView: 'edit',
  locationsView: 'edit',
  schedulingView: 'list',
  q: 'Restmüll',
  page: 4,
  pageSize: 25,
  fractionsStatus: 'all',
  status: 'active',
  tourValidityPeriod: 'current',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
  wasteFractionId: 'fraction-1',
  collectionLocationId: 'location-1',
  tourId: 'tour-1',
  duplicateFromTourId: 'tour-source',
};

describe('waste-management tour-shift navigation', () => {
  it('builds a clean tour-shift create route with optional original date', () => {
    expect(
      toCreateTourShiftSearch(search, {
        tourId: 'tour-42',
        originalDate: '2026-12-24',
      })
    ).toEqual({
      ...search,
      tab: 'scheduling',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'create',
      shiftContext: 'tour',
      page: 1,
      wasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      schedulingEntryType: 'tour-shift',
      schedulingEntryId: undefined,
      schedulingTourId: 'tour-42',
      schedulingOriginalDate: '2026-12-24',
    });
  });

  it('clears contextual values when leaving the creation workflow', () => {
    expect(
      clearTourShiftCreateContext({
        ...search,
        schedulingTourId: 'tour-42',
        schedulingOriginalDate: '2026-12-24',
      })
    ).toEqual({
      ...search,
      schedulingTourId: undefined,
      schedulingOriginalDate: undefined,
    });
  });

  it('prefills only an available tour and preserves an optional valid date', () => {
    expect(
      resolveTourShiftCreatePrefill(
        {
          ...search,
          tab: 'scheduling',
          schedulingView: 'create',
          schedulingEntryType: 'tour-shift',
          schedulingTourId: 'tour-42',
          schedulingOriginalDate: '2026-12-24',
        },
        [{ id: 'tour-42' }, { id: 'tour-7' }]
      )
    ).toEqual({ tourId: 'tour-42', originalDate: '2026-12-24' });

    expect(
      resolveTourShiftCreatePrefill(
        {
          ...search,
          tab: 'scheduling',
          schedulingView: 'create',
          schedulingEntryType: 'tour-shift',
          schedulingTourId: 'removed-tour',
          schedulingOriginalDate: '2026-12-24',
        },
        [{ id: 'tour-42' }]
      )
    ).toEqual({ tourId: '', originalDate: '2026-12-24' });
  });
});
