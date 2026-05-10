import { describe, expect, it } from 'vitest';

import {
  getWasteManagementImportCatalogEntry,
  wasteManagementImportCatalog,
} from './waste-management-import-catalog.js';

describe('wasteManagementImportCatalog', () => {
  it('defines the expected waste import profiles as canonical CSV templates', () => {
    expect(wasteManagementImportCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profileId: 'waste-management.geografie-abholorte', sourceFormat: 'text/csv' }),
        expect.objectContaining({ profileId: 'waste-management.touren', sourceFormat: 'text/csv' }),
        expect.objectContaining({ profileId: 'waste-management.ausweichtermine', sourceFormat: 'text/csv' }),
      ])
    );
  });

  it('resolves catalog entries for known waste profiles', () => {
    expect(getWasteManagementImportCatalogEntry('waste-management.geografie-abholorte')).toEqual(
      expect.objectContaining({
        profileId: 'waste-management.geografie-abholorte',
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
