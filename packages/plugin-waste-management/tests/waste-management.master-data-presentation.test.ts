import { describe, expect, it } from 'vitest';

import { wasteMasterDataPresentation } from '../src/waste-management.master-data.presentation.js';

describe('waste-management.master-data.presentation', () => {
  it('filters collection locations by q across address labels and ids', () => {
    const locations = wasteMasterDataPresentation.filterCollectionLocations(
      [
        {
          id: 'location-1',
          regionId: 'region-1',
          cityId: 'city-1',
          streetId: 'street-1',
          houseNumberId: 'house-1',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
        {
          id: 'location-2',
          regionId: 'region-2',
          cityId: 'city-2',
          streetId: 'street-2',
          houseNumberId: 'house-2',
          active: true,
          createdAt: '2026-05-09T10:00:00.000Z',
          updatedAt: '2026-05-09T10:00:00.000Z',
        },
      ],
      {
        tab: 'locations',
        masterDataTab: 'locations',
        q: 'hauptstraße',
        page: 1,
        pageSize: 25,
        status: 'all',
        shiftContext: 'all',
        regionId: undefined,
        cityId: undefined,
        wasteFractionId: undefined,
        tourId: undefined,
      },
      {
        fractions: [],
        regions: [
          { id: 'region-1', name: 'Nord', createdAt: '2026-05-09T10:00:00.000Z', updatedAt: '2026-05-09T10:00:00.000Z' },
          { id: 'region-2', name: 'Süd', createdAt: '2026-05-09T10:00:00.000Z', updatedAt: '2026-05-09T10:00:00.000Z' },
        ],
        cities: [
          {
            id: 'city-1',
            name: 'Musterstadt',
            regionId: 'region-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'city-2',
            name: 'Anderstadt',
            regionId: 'region-2',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        streets: [
          {
            id: 'street-1',
            name: 'Hauptstraße',
            cityId: 'city-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'street-2',
            name: 'Nebenweg',
            cityId: 'city-2',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        houseNumbers: [
          {
            id: 'house-1',
            number: '12a',
            streetId: 'street-1',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
          {
            id: 'house-2',
            number: '9',
            streetId: 'street-2',
            createdAt: '2026-05-09T10:00:00.000Z',
            updatedAt: '2026-05-09T10:00:00.000Z',
          },
        ],
        collectionLocations: [],
        locationTourLinks: [],
      }
    );

    expect(locations).toHaveLength(1);
    expect(locations[0]?.id).toBe('location-1');
  });
});
