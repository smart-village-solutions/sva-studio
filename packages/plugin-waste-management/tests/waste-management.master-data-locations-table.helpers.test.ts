import { describe, expect, it } from 'vitest';

import { createLocationsTableMaps } from '../src/waste-management.master-data-locations-table.helpers.js';

describe('createLocationsTableMaps', () => {
  it('combines year and status without removing Abholorte from the list', () => {
    const result = createLocationsTableMaps({
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      locationYear: 2027,
      locationTourStatus: 'draft',
      availableTours: [
        { id: 'draft-2027', name: 'Entwurf 2027', status: 'draft', firstDate: '2027-01-07' },
        {
          id: 'published-2027',
          name: 'Veröffentlicht 2027',
          status: 'published',
          firstDate: '2027-01-07',
        },
        {
          id: 'draft-2026',
          name: 'Entwurf 2026',
          status: 'draft',
          firstDate: '2026-01-07',
          endDate: '2026-12-31',
        },
      ] as never,
      locationTourLinks: [
        { locationId: 'location-1', tourId: 'draft-2027' },
        { locationId: 'location-1', tourId: 'published-2027' },
        { locationId: 'location-2', tourId: 'draft-2026' },
      ] as never,
    });
    expect(Array.from(result.toursById.keys())).toEqual(['draft-2027']);
    expect(result.locationToursByLocationId.get('location-1')?.map((tour) => tour.id)).toEqual([
      'draft-2027',
    ]);
    expect(result.locationToursByLocationId.has('location-2')).toBe(false);
  });
  it('filters linked tours by year while leaving location records to the unchanged list query', () => {
    const result = createLocationsTableMaps({
      regions: [],
      cities: [],
      streets: [],
      houseNumbers: [],
      locationYear: 2027,
      availableTours: [
        { id: 'old', name: '2026', firstDate: '2026-01-07', endDate: '2026-12-31' },
        { id: 'next', name: '2027', firstDate: '2027-01-21', endDate: '2027-12-31' },
        { id: 'spanning', name: 'Beide Jahre', firstDate: '2026-11-01', endDate: '2027-02-01' },
      ] as never,
      locationTourLinks: [
        { locationId: 'location-1', tourId: 'old' },
        { locationId: 'location-1', tourId: 'next' },
        { locationId: 'location-2', tourId: 'spanning' },
      ] as never,
    });

    expect(Array.from(result.toursById.keys())).toEqual(['next', 'spanning']);
    expect(result.locationToursByLocationId.get('location-1')?.map((tour) => tour.id)).toEqual([
      'next',
    ]);
    expect(result.locationToursByLocationId.get('location-2')?.map((tour) => tour.id)).toEqual([
      'spanning',
    ]);
  });
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
    expect(result.locationToursByLocationId.get('location-1')?.map((tour) => tour.id)).toEqual([
      'tour-b',
      'tour-a',
    ]);
    expect(result.locationTourNamesByLocationId.has('location-2')).toBe(false);
    expect(result.locationToursByLocationId.has('location-2')).toBe(false);
  });
});
