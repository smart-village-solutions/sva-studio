import { describe, expect, it, vi } from 'vitest';

import {
  executeImport,
  parseLocationTourPickupDateImport,
  previewLocationTourPickupDateImport,
} from './waste-management-operations.import.js';

const createRepositoryMock = () => ({
  listWasteFractions: vi.fn(async () => [
    {
      id: 'fraction-paper',
      name: 'Papier',
      translations: undefined,
      containerSize: undefined,
      color: '#00aaee',
      description: undefined,
      active: true,
      reminderConfig: {
        reminderCount: 'none' as const,
        channels: {
          push: false,
          email: false,
          calendar: false,
        },
      },
      createdAt: '',
      updatedAt: '',
    },
  ]),
  listWasteRegions: vi.fn(async () => [{ id: 'region-prignitz', name: 'Prignitz', createdAt: '', updatedAt: '' }]),
  listWasteCities: vi.fn(async () => [
    { id: 'city-perleberg', name: 'Perleberg', regionId: 'region-prignitz', createdAt: '', updatedAt: '' },
  ]),
  listWasteStreets: vi.fn(async () => [
    { id: 'street-acker', name: 'Ackerstraße', cityId: 'city-perleberg', createdAt: '', updatedAt: '' },
  ]),
  listWasteHouseNumbers: vi.fn(async () => [
    { id: 'house-all', number: 'Alle Hausnummern', streetId: 'street-acker', createdAt: '', updatedAt: '' },
  ]),
  listWasteCollectionLocations: vi.fn(async () => [
    {
      id: 'location-perleberg',
      regionId: 'region-prignitz',
      cityId: 'city-perleberg',
      streetId: 'street-acker',
      houseNumberId: 'house-all',
      active: true,
      createdAt: '',
      updatedAt: '',
    },
  ]),
  listWasteTours: vi.fn(async () => [
    {
      id: 'tour-paper',
      name: 'PPK.7.2',
      description: undefined,
      wasteFractionIds: ['fraction-paper'],
      recurrence: null,
      firstDate: undefined,
      endDate: undefined,
      customDates: undefined,
      active: true,
      locationCount: undefined,
      createdAt: '',
      updatedAt: '',
    },
  ]),
  listWasteLocationTourLinks: vi.fn(async () => [
    {
      id: 'assignment-paper',
      locationId: 'location-perleberg',
      tourId: 'tour-paper',
      startDate: undefined,
      endDate: undefined,
      createdAt: '',
      updatedAt: '',
    },
  ]),
  upsertWasteRegion: vi.fn(async () => undefined),
  upsertWasteCity: vi.fn(async () => undefined),
  upsertWasteStreet: vi.fn(async () => undefined),
  upsertWasteHouseNumber: vi.fn(async () => undefined),
  upsertWasteCollectionLocation: vi.fn(async () => undefined),
  upsertWasteFraction: vi.fn(async () => undefined),
  upsertWasteTour: vi.fn(async () => undefined),
  upsertWasteLocationTourLink: vi.fn(async () => undefined),
  upsertWasteTourDateShift: vi.fn(async () => undefined),
  upsertWasteGlobalDateShift: vi.fn(async () => undefined),
});

const parsedLocationTourPickupDates = {
  delimiter: ';',
  detectedDelimiter: ';',
  header: ['Region', 'Ort', 'Straße', 'Papier', 'Bioabfall'],
  fractionNames: ['Papier', 'Bioabfall'],
  rows: [
    {
      rowNumber: 2,
      region: 'Prignitz',
      city: 'Perleberg',
      street: 'Ackerstraße',
      houseNumbers: 'Alle Hausnummern',
      tourNamesByFractionName: {
        Papier: 'PPK.7.2',
        Bioabfall: 'BIO.3.1',
      },
    },
    {
      rowNumber: 3,
      region: 'Prignitz',
      city: 'Bad Wilsnack',
      street: 'Alle Straßen',
      houseNumbers: 'Alle Hausnummern',
      tourNamesByFractionName: {
        Papier: 'PPK.7.2',
      },
    },
  ],
  validRowCount: 2,
  invalidRowCount: 0,
  issues: [],
} as const;

describe('waste-management-operations.import', () => {
  it('parses location-based pickup date csv imports from binary sources', async () => {
    const parsed = await parseLocationTourPickupDateImport(
      {
        readBinarySource: vi.fn(async () => new TextEncoder().encode('Ort;Papier\nPerleberg;PPK.7.2\n')),
      },
      {
        sourceFormat: 'text/csv',
        blobRef: 'fixture.csv',
      }
    );

    expect(parsed).toMatchObject({
      delimiter: ';',
      detectedDelimiter: ';',
      validRowCount: 1,
      invalidRowCount: 0,
      fractionNames: ['Papier'],
    });
  });

  it('rejects location-based pickup date imports without a blob ref', async () => {
    await expect(
      parseLocationTourPickupDateImport(
        {
          readBinarySource: vi.fn(),
        },
        {
          sourceFormat: 'text/csv',
        }
      )
    ).rejects.toThrowError('missing_blob_ref');
  });

  it('rejects location-based pickup date imports with unsupported source formats', async () => {
    await expect(
      parseLocationTourPickupDateImport(
        {
          readBinarySource: vi.fn(),
        },
        {
          sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          blobRef: 'fixture.xlsx',
        }
      )
    ).rejects.toThrowError('unsupported_import_source_format:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('previews location-based pickup date imports without persisting changes', async () => {
    const repository = createRepositoryMock();

    const preview = await previewLocationTourPickupDateImport(repository, parsedLocationTourPickupDates);

    expect(preview).toMatchObject({
      profileId: 'waste-management.ortsbezogene-tourtermine',
      validRowCount: 2,
      invalidRowCount: 0,
      existingFractions: ['Papier'],
      newFractions: ['Bioabfall'],
      existingTours: ['PPK.7.2'],
      newTours: ['BIO.3.1'],
    });
    expect(repository.upsertWasteRegion).not.toHaveBeenCalled();
    expect(repository.upsertWasteTour).not.toHaveBeenCalled();
  });

  it('rejects persisted location-based imports when parsed csv data is missing', async () => {
    await expect(
      executeImport(createRepositoryMock(), {
        profileId: 'waste-management.ortsbezogene-tourtermine',
      })
    ).rejects.toThrowError('missing_location_tour_pickup_date_import');
  });

  it('rejects persisted location-based imports when preview issues are present', async () => {
    const repository = createRepositoryMock();

    await expect(
      executeImport(repository, {
        profileId: 'waste-management.ortsbezogene-tourtermine',
        parsedLocationTourPickupDates: {
          ...parsedLocationTourPickupDates,
          rows: [],
          validRowCount: 0,
          invalidRowCount: 1,
          issues: [
            {
              rowNumber: 3,
              column: 'Ort',
              message: 'Pflichtfeld fehlt',
            },
          ],
        },
      })
    ).rejects.toThrowError('location_tour_pickup_date_import_has_issues');

    expect(repository.upsertWasteCity).not.toHaveBeenCalled();
    expect(repository.upsertWasteLocationTourLink).not.toHaveBeenCalled();
  });

  it('persists created location-based pickup date entities and returns summarized counts', async () => {
    const repository = createRepositoryMock();
    const reportProgress = vi.fn();

    const result = await executeImport(repository, {
      profileId: 'waste-management.ortsbezogene-tourtermine',
      parsedLocationTourPickupDates,
      reportProgress,
    });

    expect(repository.upsertWasteRegion).not.toHaveBeenCalled();
    expect(repository.upsertWasteCity).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteStreet).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteHouseNumber).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteCollectionLocation).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteFraction).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteTour).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteLocationTourLink).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      rowCount: 2,
      createdFractions: 1,
      createdTours: 1,
      createdLocations: 1,
      createdAssignments: 2,
      skippedRows: 0,
      errorCount: 0,
    });
    expect(reportProgress).toHaveBeenCalledTimes(4);
    expect(reportProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        completedSteps: 0,
        totalSteps: 2,
        currentPhase: 'waste-management.import-preparation',
        currentStepKey: 'prepare-import',
      })
    );
    expect(reportProgress).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        completedSteps: 2,
        totalSteps: 2,
        currentPhase: 'waste-management.completed',
        currentStepKey: 'complete-operation',
      })
    );
  });

  it('does not emit progress updates for dry-run planning previews', async () => {
    const repository = createRepositoryMock();

    await previewLocationTourPickupDateImport(repository, parsedLocationTourPickupDates);

    expect(repository.upsertWasteRegion).not.toHaveBeenCalled();
    expect(repository.upsertWasteCity).not.toHaveBeenCalled();
    expect(repository.upsertWasteLocationTourLink).not.toHaveBeenCalled();
  });
});
