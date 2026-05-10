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
      masterDataTab: 'locations',
      q: '',
      page: 1,
      pageSize: 25,
      status: 'all',
      shiftContext: 'all',
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
      regionId: 'region-1',
      cityId: 'city-1',
      wasteFractionId: 'fraction-1',
      tourId: 'tour-1',
    });
  });
});
