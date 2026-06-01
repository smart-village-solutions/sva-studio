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
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourWasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      firstDateFrom: undefined,
      firstDateTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      schedulingEntryType: undefined,
      schedulingEntryId: undefined,
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
        fractionsStatus: 'inactive',
        status: 'active',
        shiftContext: 'tour',
        fractionsSortBy: 'color',
        fractionsSortDirection: 'desc',
        regionId: 'region-1',
        cityId: 'city-1',
        wasteFractionId: 'fraction-1',
        tourWasteFractionId: 'fraction-2',
        collectionLocationId: 'location-1',
        tourId: 'tour-1',
        firstDateFrom: '2026-01-01',
        firstDateTo: '2026-03-31',
        endDateFrom: '2026-10-01',
        endDateTo: '2026-12-31',
        schedulingEntryType: 'tour-shift',
        schedulingEntryId: 'tour-shift-1',
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
      fractionsStatus: 'inactive',
      status: 'active',
      shiftContext: 'tour',
      fractionsSortBy: 'color',
      fractionsSortDirection: 'desc',
      regionId: 'region-1',
      cityId: 'city-1',
      wasteFractionId: 'fraction-1',
      tourWasteFractionId: 'fraction-2',
      collectionLocationId: 'location-1',
      tourId: 'tour-1',
      duplicateFromTourId: undefined,
      firstDateFrom: '2026-01-01',
      firstDateTo: '2026-03-31',
      endDateFrom: '2026-10-01',
      endDateTo: '2026-12-31',
      schedulingEntryType: 'tour-shift',
      schedulingEntryId: 'tour-shift-1',
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
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
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourWasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      firstDateFrom: undefined,
      firstDateTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      schedulingEntryType: undefined,
      schedulingEntryId: undefined,
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
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourWasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      firstDateFrom: undefined,
      firstDateTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      schedulingEntryType: undefined,
      schedulingEntryId: undefined,
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
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourWasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      firstDateFrom: undefined,
      firstDateTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      schedulingEntryType: undefined,
      schedulingEntryId: undefined,
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
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourWasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: 'tour-42',
      firstDateFrom: undefined,
      firstDateTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      schedulingEntryType: undefined,
      schedulingEntryId: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });
  });

  it('falls back to all for invalid fractionsStatus values and keeps recognized values stable', () => {
    expect(
      normalizeWasteManagementSearchParams({
        tab: 'fractions',
        masterDataTab: 'fractions',
        fractionsStatus: 'bogus',
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
      fractionsStatus: 'all',
      status: 'all',
      shiftContext: 'all',
      fractionsSortBy: 'name',
      fractionsSortDirection: 'asc',
      regionId: undefined,
      cityId: undefined,
      wasteFractionId: undefined,
      tourWasteFractionId: undefined,
      collectionLocationId: undefined,
      tourId: undefined,
      duplicateFromTourId: undefined,
      firstDateFrom: undefined,
      firstDateTo: undefined,
      endDateFrom: undefined,
      endDateTo: undefined,
      tourDateShiftId: undefined,
      globalDateShiftId: undefined,
    });

    expect(
      normalizeWasteManagementSearchParams({
        tab: 'fractions',
        masterDataTab: 'fractions',
        fractionsStatus: 'inactive',
      })
    ).toEqual(
      expect.objectContaining({
        fractionsStatus: 'inactive',
      })
    );
  });

  it('normalizes optional date range filters as trimmed ISO dates only', () => {
    expect(
      normalizeWasteManagementSearchParams({
        tab: 'tours',
        firstDateFrom: ' 2026-01-01 ',
        firstDateTo: '2026-02-30',
        endDateFrom: 'bogus',
        endDateTo: '2026-12-31',
      })
    ).toEqual(
      expect.objectContaining({
        firstDateFrom: '2026-01-01',
        firstDateTo: undefined,
        endDateFrom: undefined,
        endDateTo: '2026-12-31',
      })
    );
  });

  it('normalizes tourWasteFractionId as a dedicated optional trimmed search param', () => {
    expect(
      normalizeWasteManagementSearchParams({
        tab: 'tours',
        wasteFractionId: 'fraction-master-data',
        tourWasteFractionId: '  fraction-tour-filter  ',
      })
    ).toEqual(
      expect.objectContaining({
        wasteFractionId: 'fraction-master-data',
        tourWasteFractionId: 'fraction-tour-filter',
      })
    );
  });
});
