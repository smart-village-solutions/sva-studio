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
      syncMainserver: 'waste-management.sync-mainserver',
      syncWasteTypes: 'waste-management.sync-waste-types',
      materializeEmailReminders: 'waste-management.materialize-email-reminders',
      processEmailReminderOutbox: 'waste-management.process-email-reminder-outbox',
    });
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.import-data')).toBe(true);
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.sync-mainserver')).toBe(true);
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.unknown')).toBe(false);
  });

  it('defines the mandatory waste import profile ids on the shared plugin contract', () => {
    expect(wasteManagementOperationsContract.importProfileIds).toEqual({
      geographyCollectionLocations: 'waste-management.geografie-abholorte',
      tours: 'waste-management.touren',
      dateShifts: 'waste-management.ausweichtermine',
      locationTourPickupDates: 'waste-management.ortsbezogene-tourtermine',
    });
    expect(wasteManagementOperationsContract.isImportProfileId('waste-management.geografie-abholorte')).toBe(true);
    expect(wasteManagementOperationsContract.isImportProfileId('waste-management.foo')).toBe(false);
  });

  it('supports csv and xlsx as the current waste import source formats', () => {
    expect(wasteManagementOperationsContract.importSourceFormats).toEqual([
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    expect(wasteManagementOperationsContract.isImportSourceFormat('text/csv')).toBe(true);
    expect(
      wasteManagementOperationsContract.isImportSourceFormat(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe(true);
    expect(wasteManagementOperationsContract.isImportSourceFormat('application/json')).toBe(false);
  });

  it('exposes the supported CSV delimiters for the address pickup-date import', () => {
    expect(wasteManagementOperationsContract.csvDelimiters).toEqual([';', ',', '\t', '|']);
    expect(wasteManagementOperationsContract.isCsvDelimiter(';')).toBe(true);
    expect(wasteManagementOperationsContract.isCsvDelimiter('\t')).toBe(true);
    expect(wasteManagementOperationsContract.isCsvDelimiter(':')).toBe(false);
  });
});
