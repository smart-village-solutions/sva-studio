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
  it('places selected locations first and sorts both groups by city, street, and house number', () => {
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

  it('applies the full address hierarchy and direction within both selection groups', () => {
    const locations = [
      {
        id: 'selected-a-two',
        label: 'Ort A / Straße A / 2',
        cityName: 'Ort A',
        streetName: 'Straße A',
        houseNumberName: '2',
      },
      {
        id: 'selected-a-ten',
        label: 'Ort A / Straße A / 10',
        cityName: 'Ort A',
        streetName: 'Straße A',
        houseNumberName: '10',
      },
      {
        id: 'unselected-a',
        label: 'Ort A / Straße B / 1',
        cityName: 'Ort A',
        streetName: 'Straße B',
        houseNumberName: '1',
      },
      {
        id: 'unselected-b',
        label: 'Ort B / Straße A / 1',
        cityName: 'Ort B',
        streetName: 'Straße A',
        houseNumberName: '1',
      },
    ];

    expect(
      orderTourAssignmentLocations(locations, ['selected-a-two', 'selected-a-ten'], {
        direction: 'desc',
      }).map((location) => location.id)
    ).toEqual(['selected-a-ten', 'selected-a-two', 'unselected-b', 'unselected-a']);
  });

  it('optionally places region before city, street, and house number', () => {
    const locations = [
      {
        id: 'city-first',
        label: 'Süd / A-Stadt',
        regionName: 'Süd',
        cityName: 'A-Stadt',
      },
      {
        id: 'region-first',
        label: 'Nord / B-Stadt',
        regionName: 'Nord',
        cityName: 'B-Stadt',
      },
    ];

    expect(orderTourAssignmentLocations(locations, []).map((location) => location.id)).toEqual([
      'city-first',
      'region-first',
    ]);
    expect(
      orderTourAssignmentLocations(locations, [], { includeRegion: true }).map(
        (location) => location.id
      )
    ).toEqual(['region-first', 'city-first']);
  });

  it('keeps missing hierarchy values last in both directions and applies stable tie-breakers', () => {
    const locations = [
      { id: 'missing', label: 'Ohne Ort', cityName: '' },
      { id: 'second', label: 'Gleicher Ort', cityName: 'Amt', streetName: 'B-Straße' },
      { id: 'first', label: 'Gleicher Ort', cityName: 'Amt', streetName: 'A-Straße' },
    ];

    expect(orderTourAssignmentLocations(locations, []).map((location) => location.id)).toEqual([
      'first',
      'second',
      'missing',
    ]);
    expect(
      orderTourAssignmentLocations(locations, [], { direction: 'desc' }).map(
        (location) => location.id
      )
    ).toEqual(['second', 'first', 'missing']);
  });
});
