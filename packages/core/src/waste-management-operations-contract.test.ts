import { describe, expect, it } from 'vitest';

import { wasteManagementOperationsContract } from './waste-management-operations-contract.js';

describe('waste-management-operations-contract', () => {
  it('defines the first stable waste job type set for generic plugin operations', () => {
    expect(wasteManagementOperationsContract.pluginId).toBe('waste-management');
    expect(wasteManagementOperationsContract.queueName).toBe('plugin-operations');
    expect(wasteManagementOperationsContract.jobTypeIds).toEqual({
      provisionTenantDatabase: 'waste-management.provision-tenant-database',
      tenantReadiness: 'waste-management.tenant-readiness',
      initializeDataSource: 'waste-management.initialize-data-source',
      applyMigrations: 'waste-management.apply-migrations',
      importData: 'waste-management.import-data',
      exportData: 'waste-management.export-data',
      seedData: 'waste-management.seed-data',
      resetData: 'waste-management.reset-data',
      syncMainserver: 'waste-management.sync-mainserver',
      syncWasteTypes: 'waste-management.sync-waste-types',
      enrichPostalCodes: 'waste-management.enrich-postal-codes',
      materializeEmailReminders: 'waste-management.materialize-email-reminders',
      processEmailReminderOutbox: 'waste-management.process-email-reminder-outbox',
    });
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.import-data')).toBe(
      true
    );
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.sync-mainserver')).toBe(
      true
    );
    expect(wasteManagementOperationsContract.isJobTypeId('waste-management.unknown')).toBe(false);
  });

  it('defines the mandatory waste import profile ids on the shared plugin contract', () => {
    expect(wasteManagementOperationsContract.importProfileIds).toEqual({
      fractions: 'waste-management.fraktionen',
      geographyCollectionLocations: 'waste-management.geografie-abholorte',
      recurrencePresets: 'waste-management.abstandspresets',
      tours: 'waste-management.touren',
      locationTourLinks: 'waste-management.abholort-tour-zuordnungen',
      tourAssignments: 'waste-management.tour-einsaetze',
      dateShifts: 'waste-management.ausweichtermine',
      holidayRules: 'waste-management.feiertagsregeln',
      portableSettings: 'waste-management.portable-einstellungen',
      dataPackage: 'waste-management.datenpaket',
      locationTourPickupDates: 'waste-management.ortsbezogene-tourtermine',
    });
    expect(
      wasteManagementOperationsContract.isImportProfileId('waste-management.geografie-abholorte')
    ).toBe(true);
    expect(wasteManagementOperationsContract.isImportProfileId('waste-management.foo')).toBe(false);
  });

  it('supports canonical JSON and ZIP plus the legacy tabular import formats', () => {
    expect(wasteManagementOperationsContract.importSourceFormats).toEqual([
      'application/json',
      'application/zip',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    expect(wasteManagementOperationsContract.isImportSourceFormat('text/csv')).toBe(true);
    expect(
      wasteManagementOperationsContract.isImportSourceFormat(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe(true);
    expect(wasteManagementOperationsContract.isImportSourceFormat('application/json')).toBe(true);
  });

  it('exposes the supported CSV delimiters for the address pickup-date import', () => {
    expect(wasteManagementOperationsContract.csvDelimiters).toEqual([';', ',', '\t', '|']);
    expect(wasteManagementOperationsContract.isCsvDelimiter(';')).toBe(true);
    expect(wasteManagementOperationsContract.isCsvDelimiter('\t')).toBe(true);
    expect(wasteManagementOperationsContract.isCsvDelimiter(':')).toBe(false);
  });
});
