import { describe, expect, it } from 'vitest';

import { resolveTourAssignmentLocationOptions } from '../src/waste-management.tours.locations.js';

describe('resolveTourAssignmentLocationOptions', () => {
  it('exposes every address hierarchy value separately with localized fallbacks', () => {
    const pt = (key: string) => key;

    expect(
      resolveTourAssignmentLocationOptions(
        pt,
        {
          regions: [{ id: 'region-1', name: 'Amt Meyenburg' }],
          cities: [{ id: 'city-1', name: 'Brügge' }],
          streets: [],
          houseNumbers: [],
          collectionLocations: [
            {
              id: 'location-1',
              regionId: 'region-1',
              cityId: 'city-1',
              active: true,
            },
          ],
          locationTourLinks: [{ id: 'link-1', locationId: 'location-1', tourId: 'tour-1' }],
        } as never,
        'tour-1'
      )
    ).toEqual([
      expect.objectContaining({
        id: 'location-1',
        regionName: 'Amt Meyenburg',
        cityName: 'Brügge',
        streetName: 'masterData.collectionLocations.meta.allStreets',
        houseNumberName: 'masterData.collectionLocations.meta.allHouseNumbers',
        assignedLinkId: 'link-1',
      }),
    ]);
  });
});
