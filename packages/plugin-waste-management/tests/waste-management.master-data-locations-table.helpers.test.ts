import { describe, expect, it } from 'vitest';

import { createLocationsTableMaps } from '../src/waste-management.master-data-locations-table.helpers.js';

describe('createLocationsTableMaps', () => {
  it('resolves location tour names through the tour map and sorts them once per location', () => {
    const result = createLocationsTableMaps({
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      availableTours: [
        { id: 'tour-b', name: 'Bio' } as never,
        { id: 'tour-a', name: 'Papier' } as never,
      ],
      locationTourLinks: [
        { id: 'link-1', locationId: 'location-1', tourId: 'tour-a' } as never,
        { id: 'link-2', locationId: 'location-1', tourId: 'tour-b' } as never,
        { id: 'link-3', locationId: 'location-2', tourId: 'missing-tour' } as never,
      ],
    });

    expect(result.toursById.get('tour-a')?.name).toBe('Papier');
    expect(result.locationTourNamesByLocationId.get('location-1')).toEqual(['Bio', 'Papier']);
    expect(result.locationTourNamesByLocationId.has('location-2')).toBe(false);
  });
});
