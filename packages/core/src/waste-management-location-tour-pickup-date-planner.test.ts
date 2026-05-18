import { describe, expect, it } from 'vitest';

import { planWasteLocationTourPickupDateImport } from './waste-management-location-tour-pickup-date-planner.js';

describe('planWasteLocationTourPickupDateImport', () => {
  it('tracks created and existing master data entities across parsed rows', () => {
    const plan = planWasteLocationTourPickupDateImport(
      {
        fractions: [
          {
            id: 'fraction-existing',
            name: 'Papier',
            color: '#ffffff',
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        regions: [{ id: 'region-existing', name: 'Prignitz', createdAt: '', updatedAt: '' }],
        cities: [{ id: 'city-existing', name: 'Perleberg', regionId: 'region-existing', createdAt: '', updatedAt: '' }],
        streets: [{ id: 'street-existing', name: 'Ackerstr.', cityId: 'city-existing', createdAt: '', updatedAt: '' }],
        houseNumbers: [{ id: 'house-existing', number: 'Alle Hausnummern', streetId: 'street-existing', createdAt: '', updatedAt: '' }],
        locations: [
          {
            id: 'location-existing',
            regionId: 'region-existing',
            cityId: 'city-existing',
            streetId: 'street-existing',
            houseNumberId: 'house-existing',
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        tours: [
          {
            id: 'tour-existing',
            name: 'PPK.7.2',
            wasteFractionIds: ['fraction-existing'],
            recurrence: null,
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        assignments: [
          {
            id: 'assignment-existing',
            locationId: 'location-existing',
            tourId: 'tour-existing',
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
      {
        rows: [
          {
            rowNumber: 2,
            region: 'Prignitz',
            city: 'Perleberg',
            street: 'Ackerstr.',
            houseNumbers: 'Alle Hausnummern',
            tourNamesByFractionName: {
              Papier: 'PPK.7.2',
              Bio: 'BIO.3.1',
            },
          },
          {
            rowNumber: 3,
            region: 'Prignitz',
            city: 'Bad Wilsnack',
            street: 'Alle Straßen',
            houseNumbers: 'Alle Hausnummern',
            tourNamesByFractionName: {
              Bio: 'BIO.3.1',
            },
          },
        ],
      },
      {
        createId: (() => {
          let counter = 0;
          return () => `generated-${++counter}`;
        })(),
      }
    );

    expect(plan.summary).toEqual({
      fractions: { existing: 1, created: 1 },
      regions: { existing: 1, created: 0 },
      cities: { existing: 1, created: 1 },
      streets: { existing: 1, created: 1 },
      houseNumbers: { existing: 1, created: 1 },
      locations: { existing: 1, created: 1 },
      assignments: { existing: 1, created: 2 },
    });
    expect(plan.existingFractions).toEqual(['Papier']);
    expect(plan.newFractions).toEqual(['Bio']);
    expect(plan.existingTours).toEqual(['PPK.7.2']);
    expect(plan.newTours).toEqual(['BIO.3.1']);
    expect(plan.upserts.fractions).toEqual([
      expect.objectContaining({
        name: 'Bio',
        color: '#808080',
      }),
    ]);
    expect(plan.upserts.tours).toEqual([
      expect.objectContaining({
        name: 'BIO.3.1',
        wasteFractionIds: ['generated-1'],
      }),
    ]);
    expect(plan.upserts.assignments).toHaveLength(2);
  });

  it('deduplicates repeated existing assignments and updates existing tours with additional fractions', () => {
    const plan = planWasteLocationTourPickupDateImport(
      {
        fractions: [
          {
            id: 'fraction-paper',
            name: 'Papier',
            color: '#ffffff',
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        regions: [{ id: 'region-existing', name: 'Prignitz', createdAt: '', updatedAt: '' }],
        cities: [{ id: 'city-existing', name: 'Perleberg', regionId: 'region-existing', createdAt: '', updatedAt: '' }],
        streets: [{ id: 'street-existing', name: 'Ackerstraße', cityId: 'city-existing', createdAt: '', updatedAt: '' }],
        houseNumbers: [{ id: 'house-existing', number: 'Alle Hausnummern', streetId: 'street-existing', createdAt: '', updatedAt: '' }],
        locations: [
          {
            id: 'location-existing',
            regionId: 'region-existing',
            cityId: 'city-existing',
            streetId: 'street-existing',
            houseNumberId: 'house-existing',
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        tours: [
          {
            id: 'tour-existing',
            name: 'Gemischt.1',
            wasteFractionIds: ['fraction-paper'],
            recurrence: null,
            active: true,
            createdAt: '',
            updatedAt: '',
          },
        ],
        assignments: [
          {
            id: 'assignment-existing',
            locationId: 'location-existing',
            tourId: 'tour-existing',
            createdAt: '',
            updatedAt: '',
          },
        ],
      },
      {
        rows: [
          {
            rowNumber: 2,
            region: 'Prignitz',
            city: 'Perleberg',
            street: 'Ackerstraße',
            houseNumbers: 'Alle Hausnummern',
            tourNamesByFractionName: {
              Papier: 'Gemischt.1',
              Bio: 'Gemischt.1',
            },
          },
          {
            rowNumber: 3,
            region: 'Prignitz',
            city: 'Perleberg',
            street: 'Ackerstraße',
            houseNumbers: 'Alle Hausnummern',
            tourNamesByFractionName: {
              Papier: 'Gemischt.1',
            },
          },
        ],
      },
      {
        createId: (() => {
          let counter = 0;
          return () => `generated-${++counter}`;
        })(),
      }
    );

    expect(plan.summary).toEqual({
      fractions: { existing: 1, created: 1 },
      regions: { existing: 1, created: 0 },
      cities: { existing: 1, created: 0 },
      streets: { existing: 1, created: 0 },
      houseNumbers: { existing: 1, created: 0 },
      locations: { existing: 1, created: 0 },
      assignments: { existing: 1, created: 0 },
    });
    expect(plan.existingFractions).toEqual(['Papier']);
    expect(plan.newFractions).toEqual(['Bio']);
    expect(plan.existingTours).toEqual(['Gemischt.1']);
    expect(plan.newTours).toEqual([]);
    expect(plan.upserts.fractions).toEqual([
      expect.objectContaining({
        id: 'generated-1',
        name: 'Bio',
      }),
    ]);
    expect(plan.upserts.tours).toEqual([
      expect.objectContaining({
        id: 'tour-existing',
        name: 'Gemischt.1',
        wasteFractionIds: ['fraction-paper', 'generated-1'],
      }),
    ]);
    expect(plan.upserts.assignments).toEqual([]);
  });

  it('creates optional regions only when present and keeps regionless locations separate', () => {
    const plan = planWasteLocationTourPickupDateImport(
      {
        fractions: [],
        regions: [],
        cities: [],
        streets: [],
        houseNumbers: [],
        locations: [],
        tours: [],
        assignments: [],
      },
      {
        rows: [
          {
            rowNumber: 2,
            region: undefined,
            city: 'Perleberg',
            street: 'Alle Straßen',
            houseNumbers: 'Alle Hausnummern',
            tourNamesByFractionName: {
              Papier: 'PPK.7.2',
            },
          },
          {
            rowNumber: 3,
            region: 'Nord',
            city: 'Perleberg',
            street: 'Alle Straßen',
            houseNumbers: 'Alle Hausnummern',
            tourNamesByFractionName: {
              Bio: 'BIO.2.1',
            },
          },
        ],
      },
      {
        createId: (() => {
          let counter = 0;
          return () => `generated-${++counter}`;
        })(),
      }
    );

    expect(plan.summary).toEqual({
      fractions: { existing: 0, created: 2 },
      regions: { existing: 0, created: 1 },
      cities: { existing: 0, created: 2 },
      streets: { existing: 0, created: 2 },
      houseNumbers: { existing: 0, created: 2 },
      locations: { existing: 0, created: 2 },
      assignments: { existing: 0, created: 2 },
    });
    expect(plan.newFractions).toEqual(['Bio', 'Papier']);
    expect(plan.newTours).toEqual(['BIO.2.1', 'PPK.7.2']);
    expect(plan.upserts.regions).toEqual([
      expect.objectContaining({
        name: 'Nord',
      }),
    ]);
    expect(plan.upserts.cities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ regionId: undefined, name: 'Perleberg' }),
        expect.objectContaining({ name: 'Perleberg' }),
      ])
    );
    expect(plan.upserts.cities.some((city) => city.regionId !== undefined)).toBe(true);
  });
});
