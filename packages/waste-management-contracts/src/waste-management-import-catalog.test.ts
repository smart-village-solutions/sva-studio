import { describe, expect, it } from 'vitest';

import {
  getWasteManagementImportCatalogEntry,
  wasteManagementImportCatalog,
} from './waste-management-import-catalog.js';
import { parseWasteLocationTourPickupDateCsv } from './waste-management-location-tour-pickup-date-parser.js';

describe('wasteManagementImportCatalog', () => {
  it('defines the expected waste import profiles with csv and xlsx template variants', () => {
    expect(wasteManagementImportCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: 'waste-management.geografie-abholorte',
          sourceFormats: expect.arrayContaining([
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]),
        }),
        expect.objectContaining({
          profileId: 'waste-management.touren',
          sourceFormats: expect.arrayContaining([
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]),
        }),
        expect.objectContaining({
          profileId: 'waste-management.ausweichtermine',
          sourceFormats: expect.arrayContaining([
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]),
        }),
        expect.objectContaining({
          profileId: 'waste-management.ortsbezogene-tourtermine',
          sourceFormats: ['text/csv'],
          templateHeaders: expect.arrayContaining(['Einsatz-ID', 'Ort', 'Abholdatum', 'Hinweis']),
        }),
      ])
    );
  });

  it('provides a valid CSV template for undated assignments and dated stops', () => {
    const profile = getWasteManagementImportCatalogEntry('waste-management.ortsbezogene-tourtermine');
    if (!profile?.templateHeaders || !profile.templateSampleRows) {
      throw new Error('Tour assignment CSV template missing');
    }
    const text = [profile.templateHeaders, ...profile.templateSampleRows]
      .map((cells) => cells.join(profile.templateDelimiter))
      .join('\n');
    const result = parseWasteLocationTourPickupDateCsv({ text });

    expect(result.issues).toEqual([]);
    expect(result.rows).toMatchObject([
      { city: 'Perleberg', tourNamesByFractionName: { Papier: 'PPK.7.2' } },
      {
        assignmentId: '73d06a46-9a54-4db3-8a41-b67c3ec9d88d',
        city: 'Bad Wilsnack',
        pickupDate: '2027-02-03',
        note: '09:00 Markt',
        tourNamesByFractionName: { Schadstoffmobil: 'SM.1' },
      },
    ]);
  });

  it('resolves catalog entries for known waste profiles', () => {
    expect(getWasteManagementImportCatalogEntry('waste-management.geografie-abholorte')).toEqual(
      expect.objectContaining({
        profileId: 'waste-management.geografie-abholorte',
        mappingTemplates: expect.arrayContaining([
          expect.objectContaining({ sourceFormat: 'text/csv' }),
          expect.objectContaining({
            sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ]),
      })
    );
    expect(getWasteManagementImportCatalogEntry('waste-management.touren')).toEqual(
      expect.objectContaining({
        profileId: 'waste-management.touren',
      })
    );
    expect(getWasteManagementImportCatalogEntry('waste-management.ausweichtermine')).toEqual(
      expect.objectContaining({
        profileId: 'waste-management.ausweichtermine',
      })
    );
    expect(getWasteManagementImportCatalogEntry('waste-management.ortsbezogene-tourtermine')).toEqual(
      expect.objectContaining({
        profileId: 'waste-management.ortsbezogene-tourtermine',
        templateDelimiter: ';',
      })
    );
  });

  it('derives canonical JSON field requirements from the shared data profile', () => {
    expect(getWasteManagementImportCatalogEntry('waste-management.fraktionen')).toMatchObject({
      optionalColumns: expect.arrayContaining([
        { key: 'fraction.pdfShortLabel', required: false },
      ]),
    });
  });
});
