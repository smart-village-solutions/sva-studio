import { describe, expect, it } from 'vitest';

import { normalizeWasteManagementSearchParams } from '../src/search-params.js';

describe('waste-management search params', () => {
  it('normalizes invalid values to the canonical defaults', () => {
    expect(
      normalizeWasteManagementSearchParams({
        tab: 'bogus',
        masterDataTab: 'bogus',
        q: '  ',
        page: '0',
        pageSize: '999',
        status: 'nope',
        shiftContext: 'unknown',
        regionId: '  ',
      })
    ).toEqual({
      tab: 'fractions',
      masterDataTab: 'fractions',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
  });

  it('keeps recognized deep-link values stable', () => {
    expect(
      normalizeWasteManagementSearchParams({
        tab: 'locations',
        masterDataTab: 'locations',
        q: 'Bio',
        page: '3',
        pageSize: '50',
        status: 'active',
        shiftContext: 'tour',
        fractionsSortBy: 'color',
        fractionsSortDirection: 'desc',
        regionId: 'region-1',
        cityId: 'city-1',
        wasteFractionId: 'fraction-1',
        collectionLocationId: 'location-1',
        tourId: 'tour-1',
        tourDateShiftId: 'tour-shift-1',
        globalDateShiftId: 'global-shift-1',
      })
    ).toEqual({
      tab: 'locations',
      masterDataTab: 'locations',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'list',
      q: 'Bio',
      page: 3,
      pageSize: 50,
      status: 'active',
      shiftContext: 'tour',
      fractionsSortBy: 'color',
      fractionsSortDirection: 'desc',
      regionId: 'region-1',
      cityId: 'city-1',
      wasteFractionId: 'fraction-1',
      collectionLocationId: 'location-1',
      tourId: 'tour-1',
      tourDateShiftId: 'tour-shift-1',
      globalDateShiftId: 'global-shift-1',
    });
  });

  it('synchronizes masterDataTab with the active master-data tab', () => {
    expect(
      normalizeWasteManagementSearchParams({
        tab: 'fractions',
        masterDataTab: 'locations',
      })
    ).toEqual({
      tab: 'fractions',
      masterDataTab: 'fractions',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
  });

  it('falls back to canonical fraction sort defaults for invalid sort values', () => {
    expect(
      normalizeWasteManagementSearchParams({
        fractionsSortBy: 'bogus',
        fractionsSortDirection: 'sideways',
      })
    ).toEqual({
      tab: 'fractions',
      masterDataTab: 'fractions',
      fractionsView: 'list',
      toursView: 'list',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
  });

  it('falls back to the default page size when an unsupported page size is used', () => {
    expect(
      normalizeWasteManagementSearchParams({
        page: '3',
        pageSize: 'all',
      })
    ).toEqual({
      tab: 'fractions',
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
      collectionLocationId: undefined,
      tourId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
  });

  it('normalizes duplicateFromTourId as optional trimmed search param', () => {
    expect(
      normalizeWasteManagementSearchParams({
        tab: 'tours',
        toursView: 'create',
        duplicateFromTourId: '  tour-42  ',
      })
    ).toEqual({
      tab: 'tours',
      masterDataTab: 'locations',
      fractionsView: 'list',
      toursView: 'create',
      locationsView: 'list',
      schedulingView: 'list',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: 'tour-42',
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
  });
});
