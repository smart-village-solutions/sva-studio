import { describe, expect, it, vi } from 'vitest';

import type { WasteManagementDataExchangeRecord } from '@sva/core';

import {
  comparableWasteDataRecord,
  loadExistingWasteDataRecord,
  materializeWasteDataRecord,
  upsertWasteDataRecord,
} from './waste-management-data-exchange-records.server.js';

const repository = {
  getWasteFractionById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteRegionById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteCityById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteStreetById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteHouseNumberById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteCollectionLocationById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteCustomRecurrencePresetById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteTourById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteLocationTourLinkById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteTourAssignmentById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteGlobalDateShiftById: vi.fn(async () => ({ id: 'record-1' })),
  getWasteTourDateShiftById: vi.fn(async () => ({ id: 'record-1' })),
  listWasteHolidayRules: vi.fn(async () => [{ id: 'record-1' }, { id: 'other' }]),
  getWastePdfStaticSettings: vi.fn(async () => ({ pdfContactBlock: 'Kontakt' })),
  upsertWasteFraction: vi.fn(async () => undefined),
  upsertWasteRegion: vi.fn(async () => undefined),
  upsertWasteCity: vi.fn(async () => undefined),
  upsertWasteStreet: vi.fn(async () => undefined),
  upsertWasteHouseNumber: vi.fn(async () => undefined),
  upsertWasteCollectionLocation: vi.fn(async () => undefined),
  upsertWasteCustomRecurrencePreset: vi.fn(async () => undefined),
  upsertWasteTour: vi.fn(async () => undefined),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  upsertWasteTourAssignment: vi.fn(async () => undefined),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  upsertWasteHolidayRule: vi.fn(async () => undefined),
  upsertWastePdfStaticSettings: vi.fn(async () => undefined),
} as unknown as Parameters<typeof loadExistingWasteDataRecord>[0];

const record = (entityType: string, id: unknown = 'record-1') =>
  ({ entityType, id }) as WasteManagementDataExchangeRecord;

const recordRepositoryMethods = [
  ['fraction', 'getWasteFractionById', 'upsertWasteFraction'],
  ['region', 'getWasteRegionById', 'upsertWasteRegion'],
  ['city', 'getWasteCityById', 'upsertWasteCity'],
  ['street', 'getWasteStreetById', 'upsertWasteStreet'],
  ['houseNumber', 'getWasteHouseNumberById', 'upsertWasteHouseNumber'],
  ['collectionLocation', 'getWasteCollectionLocationById', 'upsertWasteCollectionLocation'],
  ['recurrencePreset', 'getWasteCustomRecurrencePresetById', 'upsertWasteCustomRecurrencePreset'],
  ['tour', 'getWasteTourById', 'upsertWasteTour'],
  ['locationTourLink', 'getWasteLocationTourLinkById', 'upsertWasteLocationTourLink'],
  ['tourAssignment', 'getWasteTourAssignmentById', 'upsertWasteTourAssignment'],
  ['globalDateShift', 'getWasteGlobalDateShiftById', 'upsertWasteGlobalDateShift'],
  ['tourDateShift', 'getWasteTourDateShiftById', 'upsertWasteTourDateShift'],
] as const;

describe('Waste data exchange record helpers', () => {
  it.each(recordRepositoryMethods)(
    'loads and upserts %s records through the matching repository methods',
    async (entityType, getterName, upsertName) => {
      const value = record(entityType);

      await expect(loadExistingWasteDataRecord(repository, value)).resolves.toEqual({
        id: 'record-1',
      });
      await upsertWasteDataRecord(repository, value);

      expect(repository[getterName]).toHaveBeenCalledWith('record-1');
      expect(repository[upsertName]).toHaveBeenCalledWith(value);
    }
  );

  it('uses an empty id for records without a string id', async () => {
    await loadExistingWasteDataRecord(repository, record('fraction', 42));

    expect(repository.getWasteFractionById).toHaveBeenCalledWith('');
  });

  it('loads holiday rules by id and returns null when no rule matches', async () => {
    await expect(loadExistingWasteDataRecord(repository, record('holidayRule'))).resolves.toEqual({
      id: 'record-1',
    });
    await expect(
      loadExistingWasteDataRecord(repository, record('holidayRule', 'missing'))
    ).resolves.toBeNull();
  });

  it('loads and upserts singleton portable settings', async () => {
    const value = record('portableSettings', undefined);

    await expect(loadExistingWasteDataRecord(repository, value)).resolves.toEqual({
      pdfContactBlock: 'Kontakt',
    });
    await upsertWasteDataRecord(repository, value);

    expect(repository.getWastePdfStaticSettings).toHaveBeenCalledWith();
    expect(repository.upsertWastePdfStaticSettings).toHaveBeenCalledWith(value);
  });

  it('upserts holiday rules', async () => {
    const value = record('holidayRule');

    await upsertWasteDataRecord(repository, value);

    expect(repository.upsertWasteHolidayRule).toHaveBeenCalledWith(value);
  });

  it('rejects unsupported entities for reads, materialization, and writes', async () => {
    const value = record('unsupported');

    await expect(loadExistingWasteDataRecord(repository, value)).rejects.toThrow(
      'unsupported_waste_data_entity:unsupported'
    );
    expect(() =>
      materializeWasteDataRecord('waste-management.fraktionen', value, null, [])
    ).toThrow('unsupported_waste_data_entity:unsupported');
    await expect(upsertWasteDataRecord(repository, value)).rejects.toThrow(
      'unsupported_waste_data_entity:unsupported'
    );
  });

  it('preserves target values, applies defaults, clears nulls, and excludes target fields', () => {
    const defaultedFields: string[] = [];
    const result = materializeWasteDataRecord(
      'waste-management.fraktionen',
      {
        entityType: 'fraction',
        id: 'fraction-1',
        name: 'Bio',
        color: '#00aa00',
        description: null,
      } as WasteManagementDataExchangeRecord,
      { active: false, createdAt: '2026-01-01T00:00:00.000Z' },
      defaultedFields
    );

    expect(result).toMatchObject({
      entityType: 'fraction',
      id: 'fraction-1',
      name: 'Bio',
      color: '#00aa00',
      description: undefined,
      active: false,
      reminderConfig: {
        reminderCount: 'none',
        channels: { push: false, email: false, calendar: false },
      },
    });
    expect(result).not.toHaveProperty('createdAt');
    expect(defaultedFields).toEqual(['fraction.fraction-1.reminderConfig']);
  });

  it('tracks all defaults for a new record and uses the singleton fallback label', () => {
    const defaultedFields: string[] = [];

    materializeWasteDataRecord(
      'waste-management.fraktionen',
      { entityType: 'fraction' } as WasteManagementDataExchangeRecord,
      null,
      defaultedFields
    );

    expect(defaultedFields).toEqual([
      'fraction.singleton.active',
      'fraction.singleton.reminderConfig',
    ]);
  });

  it('normalizes records for stable comparisons', () => {
    expect(
      comparableWasteDataRecord({
        z: 2,
        entityType: 'fraction',
        updatedAt: 'later',
        locationCount: 12,
        a: 1,
        createdAt: 'earlier',
      })
    ).toBe('{"a":1,"z":2}');
  });
});
