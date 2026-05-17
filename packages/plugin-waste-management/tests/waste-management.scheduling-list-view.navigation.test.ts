import { describe, expect, it } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import {
  resolveSingleTourId,
  toCreateGlobalShiftSearch,
  toCreateTourShiftSearch,
  toEditGlobalShiftSearch,
  toEditTourShiftSearch,
  toSchedulingPageSearch,
  toSchedulingPageSizeSearch,
} from '../src/waste-management.scheduling-list-view.navigation.js';

const createSearch = (): WasteManagementSearchParams => ({
  tab: 'scheduling',
  masterDataTab: 'fractions',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'list',
  q: '',
  page: 3,
  pageSize: 25,
  status: 'all',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
  regionId: undefined,
  cityId: undefined,
  wasteFractionId: undefined,
  tourId: undefined,
  tourDateShiftId: undefined,
  globalDateShiftId: undefined,
});

describe('waste-management.scheduling-list-view.navigation', () => {
  it('prefills the only available tour id', () => {
    expect(resolveSingleTourId([])).toBe('');
    expect(resolveSingleTourId([{ id: 'tour-1' }, { id: 'tour-2' }])).toBe('');
    expect(resolveSingleTourId([{ id: 'tour-1' }])).toBe('tour-1');
  });

  it('builds create and edit search states for scheduling views', () => {
    const search = createSearch();

    expect(toCreateGlobalShiftSearch(search)).toEqual({
      ...search,
      schedulingView: 'create-global',
      globalDateShiftId: undefined,
      tourDateShiftId: undefined,
    });

    expect(toCreateTourShiftSearch(search)).toEqual({
      ...search,
      schedulingView: 'create-tour',
      globalDateShiftId: undefined,
      tourDateShiftId: undefined,
    });

    expect(toEditGlobalShiftSearch(search, 'global-1')).toEqual({
      ...search,
      schedulingView: 'edit-global',
      globalDateShiftId: 'global-1',
      tourDateShiftId: undefined,
    });

    expect(toEditTourShiftSearch(search, 'tour-shift-1')).toEqual({
      ...search,
      schedulingView: 'edit-tour',
      globalDateShiftId: undefined,
      tourDateShiftId: 'tour-shift-1',
    });
  });

  it('builds paging search states for scheduling views', () => {
    const search = createSearch();

    expect(toSchedulingPageSearch(search, 5)).toEqual({
      ...search,
      page: 5,
    });

    expect(toSchedulingPageSizeSearch(search, 100)).toEqual({
      ...search,
      page: 1,
      pageSize: 100,
    });
  });
});
