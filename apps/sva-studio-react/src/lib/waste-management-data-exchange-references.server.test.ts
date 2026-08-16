import { describe, expect, it, vi } from 'vitest';

import {
  getWasteManagementDataProfile,
  type WasteManagementDataExchangeRecord,
  type WasteManagementDataProfileId,
} from '@sva/core';

vi.mock('@sva/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@sva/core')>();
  return {
    ...original,
    getWasteManagementDataProfile: vi.fn(original.getWasteManagementDataProfile),
  };
});

import { validateWasteDataReferences } from './waste-management-data-exchange-references.server.js';

const listMethods = {
  listWasteFractions: vi.fn(async () => [{ id: 'fraction-target' }]),
  listWasteRegions: vi.fn(async () => [{ id: 'region-target' }]),
  listWasteCities: vi.fn(async () => [{ id: 'city-target' }]),
  listWasteStreets: vi.fn(async () => [{ id: 'street-target' }]),
  listWasteHouseNumbers: vi.fn(async () => [{ id: 'house-target' }]),
  listWasteCollectionLocations: vi.fn(async () => [{ id: 'location-target' }]),
  listWasteCustomRecurrencePresets: vi.fn(async () => [{ id: 'preset-target' }]),
  listWasteTours: vi.fn(async () => [{ id: 'tour-target' }]),
};
const repository = listMethods as unknown as Parameters<typeof validateWasteDataReferences>[0];

const validate = (
  profileId: WasteManagementDataProfileId,
  records: readonly WasteManagementDataExchangeRecord[],
  packageSourceIds?: ReadonlyMap<string, ReadonlySet<string>>
) => validateWasteDataReferences(repository, profileId, records, packageSourceIds);

describe('Waste data exchange reference validation', () => {
  it('accepts all supported repository-backed reference types', async () => {
    await validate('waste-management.geografie-abholorte', [
      { entityType: 'city', id: 'city-1', regionId: 'region-target' },
      { entityType: 'street', id: 'street-1', cityId: 'city-target' },
      { entityType: 'houseNumber', id: 'house-1', streetId: 'street-target' },
      {
        entityType: 'collectionLocation',
        id: 'location-1',
        cityId: 'city-target',
        regionId: 'region-target',
        streetId: 'street-target',
        houseNumberId: 'house-target',
      },
    ] as WasteManagementDataExchangeRecord[]);
    await validate('waste-management.touren', [
      {
        entityType: 'tour',
        id: 'tour-1',
        wasteFractionIds: ['fraction-target'],
        customRecurrenceId: 'preset-target',
      },
    ] as WasteManagementDataExchangeRecord[]);
    await validate('waste-management.abholort-tour-zuordnungen', [
      {
        entityType: 'locationTourLink',
        id: 'link-1',
        locationId: 'location-target',
        tourId: 'tour-target',
      },
    ] as WasteManagementDataExchangeRecord[]);

    expect(listMethods.listWasteFractions).toHaveBeenCalled();
    expect(listMethods.listWasteRegions).toHaveBeenCalled();
    expect(listMethods.listWasteCities).toHaveBeenCalled();
    expect(listMethods.listWasteStreets).toHaveBeenCalled();
    expect(listMethods.listWasteHouseNumbers).toHaveBeenCalled();
    expect(listMethods.listWasteCollectionLocations).toHaveBeenCalled();
    expect(listMethods.listWasteCustomRecurrencePresets).toHaveBeenCalled();
    expect(listMethods.listWasteTours).toHaveBeenCalled();
  });

  it('resolves references from records in the same profile', async () => {
    await expect(
      validate('waste-management.geografie-abholorte', [
        { entityType: 'region', id: 'region-source' },
        { entityType: 'city', id: 'city-source', regionId: 'region-source' },
        { entityType: 'street', id: 'street-source', cityId: 'city-source' },
        { entityType: 'houseNumber', id: 'house-source', streetId: 'street-source' },
        {
          entityType: 'collectionLocation',
          id: 'location-source',
          cityId: 'city-source',
          houseNumberId: 'house-source',
        },
      ] as WasteManagementDataExchangeRecord[])
    ).resolves.toBeUndefined();
  });

  it('resolves scalar and array references from other package profiles', async () => {
    const packageSourceIds = new Map<string, ReadonlySet<string>>([
      ['fraction', new Set(['fraction-package'])],
      ['recurrencePreset', new Set(['preset-package'])],
      ['collectionLocation', new Set(['location-package'])],
      ['tour', new Set(['tour-package'])],
    ]);

    await validate(
      'waste-management.touren',
      [
        {
          entityType: 'tour',
          id: 'tour-source',
          wasteFractionIds: ['fraction-package'],
          customRecurrenceId: 'preset-package',
        },
      ] as WasteManagementDataExchangeRecord[],
      packageSourceIds
    );
    await validate(
      'waste-management.tour-einsaetze',
      [
        {
          entityType: 'tourAssignment',
          id: 'assignment-1',
          tourId: 'tour-package',
          locationIds: ['location-package'],
        },
      ] as WasteManagementDataExchangeRecord[],
      packageSourceIds
    );
    await validate(
      'waste-management.ausweichtermine',
      [
        { entityType: 'globalDateShift', id: 'global-1', tourIds: ['tour-package'] },
        { entityType: 'tourDateShift', id: 'shift-1', tourId: 'tour-package' },
      ] as WasteManagementDataExchangeRecord[],
      packageSourceIds
    );
  });

  it('ignores absent and non-reference-shaped values and unknown record entities', async () => {
    await expect(
      validate('waste-management.touren', [
        { entityType: 'tour', id: 42, wasteFractionIds: 99 },
        { entityType: 'unknown', id: 'unknown-1', value: 'ignored' },
      ] as unknown as WasteManagementDataExchangeRecord[])
    ).resolves.toBeUndefined();
  });

  it('reports a missing reference with entity, singleton, field, and id', async () => {
    await expect(
      validate('waste-management.touren', [
        { entityType: 'tour', wasteFractionIds: ['fraction-missing'] },
      ] as WasteManagementDataExchangeRecord[])
    ).rejects.toThrow(
      'missing_waste_data_reference:tour:singleton:wasteFractionIds:fraction-missing'
    );
  });

  it('rejects unknown profiles', async () => {
    await expect(
      validate('waste-management.unknown' as WasteManagementDataProfileId, [])
    ).rejects.toThrow('unknown_waste_data_profile:waste-management.unknown');
  });

  it('treats references to unsupported repository entity types as missing', async () => {
    vi.mocked(getWasteManagementDataProfile).mockReturnValueOnce({
      profileId: 'waste-management.fraktionen',
      displayName: 'Test',
      description: 'Test',
      formatVersion: '1.0.0',
      dependencies: [],
      formats: ['application/json'],
      entities: [
        {
          entityType: 'testEntity',
          fields: [
            {
              key: 'unsupportedId',
              valueType: 'string',
              transfer: 'included',
              input: { kind: 'required' },
              references: { entityType: 'unsupported' },
            },
          ],
        },
      ],
    });

    await expect(
      validate('waste-management.fraktionen', [
        { entityType: 'testEntity', id: 'test-1', unsupportedId: 'missing' },
      ])
    ).rejects.toThrow(
      'missing_waste_data_reference:testEntity:test-1:unsupportedId:missing'
    );
  });
});
