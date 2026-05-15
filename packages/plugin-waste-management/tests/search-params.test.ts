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
      tourId: undefined,
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
        tourId: 'tour-1',
      })
    ).toEqual({
      tab: 'locations',
      masterDataTab: 'locations',
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
      tourId: 'tour-1',
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
      tourId: undefined,
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
      tourId: undefined,
    });
  });
});
