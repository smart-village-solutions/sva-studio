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
  listWasteRegions: vi.fn(async () => [
    { id: 'region-prignitz', name: 'Prignitz', createdAt: '', updatedAt: '' },
  ]),
  listWasteCities: vi.fn(async () => [
    {
      id: 'city-perleberg',
      name: 'Perleberg',
      regionId: 'region-prignitz',
      createdAt: '',
      updatedAt: '',
    },
  ]),
  listWasteStreets: vi.fn(async () => [
    {
      id: 'street-acker',
      name: 'Ackerstraße',
      cityId: 'city-perleberg',
      createdAt: '',
      updatedAt: '',
    },
  ]),
  listWasteHouseNumbers: vi.fn(async () => [
    {
      id: 'house-all',
      number: 'Alle Hausnummern',
      streetId: 'street-acker',
      createdAt: '',
      updatedAt: '',
    },
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
  upsertWasteLocationTourPickupDate: vi.fn(async () => undefined),
  upsertWasteTourAssignment: vi.fn(async () => undefined),
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
  it('groups multiple location rows with one assignment id into a single assignment write', async () => {
    const repository = createRepositoryMock();
    repository.listWasteHouseNumbers.mockResolvedValue([
      {
        id: 'house-all',
        number: 'Alle Hausnummern',
        streetId: 'street-acker',
        createdAt: '',
        updatedAt: '',
      },
      { id: 'house-12', number: '12', streetId: 'street-acker', createdAt: '', updatedAt: '' },
    ]);
    repository.listWasteCollectionLocations.mockResolvedValue([
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
      {
        id: 'location-perleberg-12',
        regionId: 'region-prignitz',
        cityId: 'city-perleberg',
        streetId: 'street-acker',
        houseNumberId: 'house-12',
        active: true,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const assignmentId = '73d06a46-9a54-4db3-8a41-b67c3ec9d88d';
    const parsed = {
      delimiter: ';' as const,
      detectedDelimiter: ';' as const,
      header: [
        'Einsatz-ID',
        'Region',
        'Ort',
        'Straße',
        'Hausnummern',
        'Abholdatum',
        'Hinweis',
        'Papier',
      ],
      fractionNames: ['Papier'],
      rows: ['Alle Hausnummern', '12'].map((houseNumbers, index) => ({
        rowNumber: index + 2,
        assignmentId,
        region: 'Prignitz',
        city: 'Perleberg',
        street: 'Ackerstraße',
        houseNumbers,
        pickupDate: '2026-06-10',
        note: undefined,
        tourNamesByFractionName: { Papier: 'PPK.7.2' },
      })),
      validRowCount: 2,
      invalidRowCount: 0,
      issues: [],
    };

    await executeImport(repository, {
      profileId: 'waste-management.ortsbezogene-tourtermine',
      parsedLocationTourPickupDates: parsed,
    });

    expect(repository.upsertWasteTourAssignment).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteTourAssignment).toHaveBeenCalledWith({
      id: assignmentId,
      tourId: 'tour-paper',
      pickupDate: '2026-06-10',
      note: null,
      locationIds: ['location-perleberg', 'location-perleberg-12'],
    });
    expect(repository.upsertWasteLocationTourPickupDate).not.toHaveBeenCalled();
  });

  it('rejects inconsistent assignment groups before persisting any import entity', async () => {
    const repository = createRepositoryMock();
    const assignmentId = '73d06a46-9a54-4db3-8a41-b67c3ec9d88d';
    const parsed = {
      delimiter: ';' as const,
      detectedDelimiter: ';' as const,
      header: ['Einsatz-ID', 'Ort', 'Abholdatum', 'Hinweis', 'Papier'],
      fractionNames: ['Papier'],
      rows: ['Erster Hinweis', 'Anderer Hinweis'].map((note, index) => ({
        rowNumber: index + 2,
        assignmentId,
        region: 'Prignitz',
        city: 'Perleberg',
        street: 'Ackerstraße',
        houseNumbers: 'Alle Hausnummern',
        pickupDate: '2026-06-10',
        note,
        tourNamesByFractionName: { Papier: 'PPK.7.2' },
      })),
      validRowCount: 2,
      invalidRowCount: 0,
      issues: [],
    };

    await expect(
      executeImport(repository, {
        profileId: 'waste-management.ortsbezogene-tourtermine',
        parsedLocationTourPickupDates: parsed,
      })
    ).rejects.toThrow(`inconsistent_tour_assignment_group:${assignmentId}`);
    expect(repository.upsertWasteRegion).not.toHaveBeenCalled();
    expect(repository.upsertWasteTourAssignment).not.toHaveBeenCalled();
  });

  it('parses location-based pickup date csv imports from binary sources', async () => {
    const parsed = await parseLocationTourPickupDateImport(
      {
        readBinarySource: vi.fn(async () =>
          new TextEncoder().encode('Ort;Papier\nPerleberg;PPK.7.2\n')
        ),
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

  it('reports invalid pickup-date values as parser issues', async () => {
    const parsed = await parseLocationTourPickupDateImport(
      {
        readBinarySource: vi.fn(async () =>
          new TextEncoder().encode('Ort;Abholdatum;Papier\nPerleberg;2026-02-30;PPK.7.2\n')
        ),
      },
      {
        sourceFormat: 'text/csv',
        blobRef: 'fixture.csv',
      }
    );

    expect(parsed.validRowCount).toBe(0);
    expect(parsed.invalidRowCount).toBe(1);
    expect(parsed.issues).toEqual([
      {
        rowNumber: 2,
        column: 'Abholdatum',
        message: 'Abholdatum muss als ISO-Datum im Format YYYY-MM-DD angegeben werden.',
        value: '2026-02-30',
      },
    ]);
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
    ).rejects.toThrowError(
      'unsupported_import_source_format:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('previews location-based pickup date imports without persisting changes', async () => {
    const repository = createRepositoryMock();

    const preview = await previewLocationTourPickupDateImport(
      repository,
      parsedLocationTourPickupDates
    );

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
      3,
      expect.objectContaining({
        completedSteps: 2,
        totalSteps: 2,
        currentPhase: 'waste-management.import-running',
        currentStepKey: 'process-rows',
        details: { processedRows: 2, totalRows: 2 },
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

  it('persists imported pickup dates with normalized optional notes fail-closed', async () => {
    const repository = createRepositoryMock();

    await executeImport(repository, {
      profileId: 'waste-management.ortsbezogene-tourtermine',
      parsedLocationTourPickupDates: {
        ...parsedLocationTourPickupDates,
        rows: [
          {
            ...parsedLocationTourPickupDates.rows[0],
            pickupDate: '2026-02-03',
            note: '  Schnee-Ersatztermin  ',
          },
          {
            ...parsedLocationTourPickupDates.rows[1],
            pickupDate: '2026-02-10',
            note: '   ',
          },
        ],
      },
    });

    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenCalledTimes(3);
    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        locationId: 'location-perleberg',
        tourId: 'tour-paper',
        pickupDate: '2026-02-03',
        note: 'Schnee-Ersatztermin',
      })
    );
    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        pickupDate: '2026-02-10',
        note: null,
      })
    );
  });

  it('normalizes name resolution and deduplicates identical explicit pickup-date writes', async () => {
    const repository = createRepositoryMock();

    await executeImport(repository, {
      profileId: 'waste-management.ortsbezogene-tourtermine',
      parsedLocationTourPickupDates: {
        ...parsedLocationTourPickupDates,
        rows: [
          {
            rowNumber: 2,
            region: 'prignitz',
            city: 'perleberg',
            street: 'ackerstraße',
            houseNumbers: 'alle hausnummern',
            pickupDate: '2026-02-03',
            note: 'Hinweis',
            tourNamesByFractionName: {
              Papier: 'ppk.7.2',
              Bioabfall: 'PPK.7.2',
            },
          },
        ],
        validRowCount: 1,
        invalidRowCount: 0,
        issues: [],
      },
    });

    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenCalledTimes(1);
    expect(repository.upsertWasteLocationTourPickupDate).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: 'location-perleberg',
        tourId: 'tour-paper',
        pickupDate: '2026-02-03',
        note: 'Hinweis',
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
