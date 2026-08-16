import { describe, expect, it } from 'vitest';

import type { WasteManagementSearchParams } from '../src/search-params.js';
import {
  toWasteCollectionLocationEditSearch,
  toWasteFractionEditSearch,
  toWasteTourEditSearch,
} from '../src/waste-management.cross-link.navigation.js';

const search: WasteManagementSearchParams = {
  tab: 'scheduling',
  masterDataTab: 'locations',
  fractionsView: 'edit',
  toursView: 'create',
  locationsView: 'edit',
  schedulingView: 'list',
  q: 'Restmüll',
  page: 4,
  pageSize: 25,
  fractionsStatus: 'all',
  status: 'all',
  tourValidityPeriod: 'all',
  shiftContext: 'all',
  fractionsSortBy: 'name',
  fractionsSortDirection: 'asc',
  wasteFractionId: 'old-fraction',
  collectionLocationId: 'old-location',
  tourId: 'old-tour',
  duplicateFromTourId: 'source-tour',
};

describe('waste-management cross-link navigation', () => {
  it('opens a tour edit view and clears unrelated entity edit state', () => {
    expect(toWasteTourEditSearch(search, 'tour-2')).toEqual(
      expect.objectContaining({
        tab: 'tours',
        toursView: 'edit',
        tourId: 'tour-2',
        fractionsView: 'list',
        wasteFractionId: undefined,
        locationsView: 'list',
        collectionLocationId: undefined,
        duplicateFromTourId: undefined,
        page: 1,
      })
    );
  });

  it('opens fraction and collection-location edit views with matching master-data tabs', () => {
    expect(toWasteFractionEditSearch(search, 'fraction-2')).toEqual(
      expect.objectContaining({
        tab: 'fractions',
        masterDataTab: 'fractions',
        fractionsView: 'edit',
        wasteFractionId: 'fraction-2',
        tourId: undefined,
      })
    );
    expect(toWasteCollectionLocationEditSearch(search, 'location-2')).toEqual(
      expect.objectContaining({
        tab: 'locations',
        masterDataTab: 'locations',
        locationsView: 'edit',
        collectionLocationId: 'location-2',
        tourId: undefined,
      })
    );
  });
});
