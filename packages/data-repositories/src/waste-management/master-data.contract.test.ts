import { describe, expect, it } from 'vitest';

import { wasteMasterDataRepositoryContract } from './master-data.contract.js';

describe('waste master-data repository contract', () => {
  it('exposes the canonical waste repository method surface', () => {
    expect(Object.keys(wasteMasterDataRepositoryContract)).toEqual([
      'listWasteFractions',
      'getWasteFractionById',
      'upsertWasteFraction',
      'deleteWasteFraction',
      'listWasteRegions',
      'getWasteRegionById',
      'upsertWasteRegion',
      'listWasteCities',
      'getWasteCityById',
      'upsertWasteCity',
      'listWasteStreets',
      'getWasteStreetById',
      'upsertWasteStreet',
      'listWasteHouseNumbers',
      'getWasteHouseNumberById',
      'upsertWasteHouseNumber',
      'listWasteCollectionLocations',
      'getWasteCollectionLocationById',
      'upsertWasteCollectionLocation',
      'deleteWasteCollectionLocation',
      'listWasteTours',
      'getWasteTourById',
      'upsertWasteTour',
      'deleteWasteTour',
      'listWasteLocationTourLinks',
      'getWasteLocationTourLinkById',
      'upsertWasteLocationTourLink',
      'listWasteLocationTourPickupDates',
      'getWasteLocationTourPickupDateById',
      'upsertWasteLocationTourPickupDate',
      'listWasteTourDateShifts',
      'getWasteTourDateShiftById',
      'upsertWasteTourDateShift',
      'listWasteGlobalDateShifts',
      'getWasteGlobalDateShiftById',
      'upsertWasteGlobalDateShift',
    ]);
    expect(Object.values(wasteMasterDataRepositoryContract)).toSatisfy((values) =>
      values.every((value) => value === undefined)
    );
  });
});
