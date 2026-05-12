import { describe, expect, it } from 'vitest';

import {
  getWasteManagementImportCatalogEntry,
  wasteManagementImportCatalog,
} from './waste-management-import-catalog.js';

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
      ])
    );
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
  });
});
