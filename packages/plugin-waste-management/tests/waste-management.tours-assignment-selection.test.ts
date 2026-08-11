import { describe, expect, it } from 'vitest';

import {
  createTourAssignmentSelectionSummary,
  orderTourAssignmentLocations,
} from '../src/waste-management.tours.view-model.js';

describe('createTourAssignmentSelectionSummary', () => {
  it.each([
    [[], [], false, false, 0],
    [['one', 'two'], ['one', 'two'], true, true, 0],
    [['one'], ['hidden'], false, false, 1],
    [[], ['hidden'], false, false, 1],
  ])(
    'summarizes visible and hidden selections',
    (
      filteredLocationIds,
      selectedLocationIds,
      allVisibleSelected,
      someVisibleSelected,
      hiddenSelectedCount
    ) => {
      expect(
        createTourAssignmentSelectionSummary({ filteredLocationIds, selectedLocationIds })
      ).toMatchObject({
        allVisibleSelected,
        someVisibleSelected,
        hiddenSelectedCount,
      });
    }
  );
});

describe('orderTourAssignmentLocations', () => {
  it('places selected locations first and sorts both groups by region, city, and street', () => {
    expect(
      orderTourAssignmentLocations(
        [
          {
            id: 'four',
            label: 'West / Zehdenick / B-Straße',
            regionName: 'West',
            cityName: 'Zehdenick',
            streetName: 'B-Straße',
          },
          {
            id: 'two',
            label: 'Ost / Angermünde / Straße 10',
            regionName: 'Ost',
            cityName: 'Angermünde',
            streetName: 'Straße 10',
          },
          {
            id: 'three',
            label: 'Ost / Angermünde / Straße 2',
            regionName: 'Ost',
            cityName: 'Angermünde',
            streetName: 'Straße 2',
          },
          {
            id: 'one',
            label: 'Ost / Berlin / A-Straße',
            regionName: 'Ost',
            cityName: 'Berlin',
            streetName: 'A-Straße',
          },
        ],
        ['three', 'one']
      )
    ).toEqual([
      expect.objectContaining({ id: 'three' }),
      expect.objectContaining({ id: 'one' }),
      expect.objectContaining({ id: 'two' }),
      expect.objectContaining({ id: 'four' }),
    ]);
  });
});
