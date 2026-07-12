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
      'getWastePdfStaticSettings',
      'upsertWastePdfStaticSettings',
      'listWasteHolidayRules',
      'upsertWasteHolidayRule',
      'deleteWasteHolidayRule',
      'listWasteCustomRecurrencePresets',
      'getWasteCustomRecurrencePresetById',
      'upsertWasteCustomRecurrencePreset',
      'deleteWasteCustomRecurrencePreset',
      'listWasteTours',
      'getWasteTourById',
      'upsertWasteTour',
      'deleteWasteTour',
      'listWasteLocationTourLinks',
      'listWasteLocationTourLinksByTourId',
      'getWasteLocationTourLinkById',
      'upsertWasteLocationTourLink',
      'deleteWasteLocationTourLink',
      'listWasteLocationTourPickupDates',
      'getWasteLocationTourPickupDateById',
      'upsertWasteLocationTourPickupDate',
      'deleteWasteLocationTourPickupDate',
      'listWasteTourAssignments',
      'getWasteTourAssignmentById',
      'upsertWasteTourAssignment',
      'deleteWasteTourAssignment',
      'listWasteTourDateShifts',
      'listWasteTourDateShiftsByTourId',
      'getWasteTourDateShiftById',
      'upsertWasteTourDateShift',
      'deleteWasteTourDateShift',
      'listWasteGlobalDateShifts',
      'getWasteGlobalDateShiftById',
      'upsertWasteGlobalDateShift',
      'deleteWasteGlobalDateShift',
    ]);
    expect(Object.values(wasteMasterDataRepositoryContract)).toSatisfy((values) =>
      values.every((value) => value === undefined)
    );
  });
});
