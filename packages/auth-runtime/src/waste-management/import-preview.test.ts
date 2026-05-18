import { describe, expect, it, vi } from 'vitest';

import { previewWasteLocationTourPickupDateImport } from './import-preview.js';

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
});

const createCsvDataUrl = (lines: readonly string[]): string =>
  `data:text/csv;base64,${Buffer.from(lines.join('\n'), 'utf8').toString('base64')}`;

describe('previewWasteLocationTourPickupDateImport', () => {
  it('summarizes existing and created entities for location-based pickup date imports', async () => {
    const preview = await previewWasteLocationTourPickupDateImport(createRepositoryMock(), {
      sourceFormat: 'text/csv',
      blobRef: createCsvDataUrl([
        'Region;Ort;Straße;Papier;Bioabfall',
        'Prignitz;Perleberg;Ackerstraße;PPK.7.2;BIO.3.1',
        'Prignitz;Bad Wilsnack;;PPK.7.2;',
      ]),
    });

    expect(preview).toMatchObject({
      profileId: 'waste-management.ortsbezogene-tourtermine',
      validRowCount: 2,
      invalidRowCount: 0,
      existingFractions: ['Papier'],
      newFractions: ['Bioabfall'],
      existingTours: ['PPK.7.2'],
      newTours: ['BIO.3.1'],
      summary: {
        fractions: { existing: 1, created: 1 },
        regions: { existing: 1, created: 0 },
        cities: { existing: 1, created: 1 },
        streets: { existing: 1, created: 1 },
        houseNumbers: { existing: 1, created: 1 },
        locations: { existing: 1, created: 1 },
        assignments: { existing: 1, created: 2 },
      },
    });
  });

  it('rejects unsupported source formats deterministically', async () => {
    await expect(
      previewWasteLocationTourPickupDateImport(createRepositoryMock(), {
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        blobRef: createCsvDataUrl(['Ort;Papier', 'Perleberg;PPK.7.2']),
      })
    ).rejects.toThrowError(
      'unsupported_import_source_format:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('parses non-base64 data urls and respects delimiter overrides', async () => {
    const preview = await previewWasteLocationTourPickupDateImport(createRepositoryMock(), {
      sourceFormat: 'text/csv',
      blobRef: `data:text/csv,${encodeURIComponent('Ort,Papier\nPerleberg,PPK.7.2')}`,
      delimiterOverride: ',',
    });

    expect(preview).toMatchObject({
      delimiter: ',',
      detectedDelimiter: ',',
      validRowCount: 1,
      invalidRowCount: 0,
      existingFractions: ['Papier'],
      existingTours: ['PPK.7.2'],
    });
  });

  it('rejects unsupported local file blob refs', async () => {
    await expect(
      previewWasteLocationTourPickupDateImport(createRepositoryMock(), {
        sourceFormat: 'text/csv',
        blobRef: '/tmp/import.csv',
      })
    ).rejects.toThrowError('unsupported_blob_ref:local_file');
  });

  it('rejects malformed data urls without payload separator', async () => {
    await expect(
      previewWasteLocationTourPickupDateImport(createRepositoryMock(), {
        sourceFormat: 'text/csv',
        blobRef: 'data:text/csv;base64',
      })
    ).rejects.toThrowError('invalid_blob_ref:data_url');
  });
});
