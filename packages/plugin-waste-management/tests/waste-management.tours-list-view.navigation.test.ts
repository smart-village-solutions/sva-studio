import { describe, expect, it } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import {
  toCreateTourSearch,
  toEditTourSearch,
  toToursPageSearch,
  toToursPageSizeSearch,
  toToursQuerySearch,
  toToursStatusSearch,
} from '../src/waste-management.tours-list-view.navigation.js';

const createSearch = (): WasteManagementSearchParams => ({
  tab: 'tours',
  masterDataTab: 'fractions',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'list',
  q: 'bio',
  page: 3,
  pageSize: 25,
  status: 'active',
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

describe('waste-management.tours-list-view.navigation', () => {
  it('builds create and edit search states for tours', () => {
    const search = createSearch();

    expect(toCreateTourSearch(search)).toEqual({
      ...search,
      toursView: 'create',
      tourId: undefined,
    });

    expect(toEditTourSearch(search, 'tour-1')).toEqual({
      ...search,
      toursView: 'edit',
      tourId: 'tour-1',
    });
  });

  it('builds filter and paging search states for tours', () => {
    const search = createSearch();

    expect(toToursPageSearch(search, 5)).toEqual({
      ...search,
      page: 5,
    });

    expect(toToursPageSizeSearch(search, 100)).toEqual({
      ...search,
      page: 1,
      pageSize: 100,
    });

    expect(toToursQuerySearch(search, 'papier')).toEqual({
      ...search,
      q: 'papier',
      page: 1,
    });

    expect(toToursStatusSearch(search, 'inactive')).toEqual({
      ...search,
      status: 'inactive',
      page: 1,
    });
  });
});
