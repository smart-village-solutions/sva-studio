import { describe, expect, it } from 'vitest';

import { wasteManagementOperationsContract } from './waste-management-operations-contract.js';

describe('waste-management-operations-contract', () => {
  it('defines the first stable waste job type set for generic plugin operations', () => {
    expect(wasteManagementOperationsContract.pluginId).toBe('waste-management');
    expect(wasteManagementOperationsContract.queueName).toBe('plugin-operations');
    expect(wasteManagementOperationsContract.jobTypeIds).toEqual({
      initializeDataSource: 'waste-management.initialize-data-source',
      applyMigrations: 'waste-management.apply-migrations',
      importData: 'waste-management.import-data',
      seedData: 'waste-management.seed-data',
      resetData: 'waste-management.reset-data',
    });
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.import-data')).toBe(true);
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.unknown')).toBe(false);
  });

  it('defines the mandatory waste import profile ids on the shared plugin contract', () => {
    expect(wasteManagementOperationsContract.importProfileIds).toEqual({
      geographyCollectionLocations: 'waste-management.geografie-abholorte',
      tours: 'waste-management.touren',
      dateShifts: 'waste-management.ausweichtermine',
    });
    expect(wasteManagementOperationsContract.isImportProfileId('waste-management.geografie-abholorte')).toBe(true);
    expect(wasteManagementOperationsContract.isImportProfileId('waste-management.foo')).toBe(false);
  });

  it('keeps csv as the first canonical source format for waste imports', () => {
    expect(wasteManagementOperationsContract.importSourceFormats).toEqual(['text/csv']);
    expect(wasteManagementOperationsContract.isImportSourceFormat('text/csv')).toBe(true);
    expect(wasteManagementOperationsContract.isImportSourceFormat('application/json')).toBe(false);
  });
});
