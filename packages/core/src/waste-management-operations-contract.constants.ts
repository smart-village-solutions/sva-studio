import { wasteManagementDataProfileIds } from './waste-management-data-exchange.js';

const wasteManagementJobTypeIds = {
  provisionTenantDatabase: 'waste-management.provision-tenant-database',
  initializeDataSource: 'waste-management.initialize-data-source',
  applyMigrations: 'waste-management.apply-migrations',
  importData: 'waste-management.import-data',
  exportData: 'waste-management.export-data',
  seedData: 'waste-management.seed-data',
  resetData: 'waste-management.reset-data',
  syncMainserver: 'waste-management.sync-mainserver',
  syncWasteTypes: 'waste-management.sync-waste-types',
  materializeEmailReminders: 'waste-management.materialize-email-reminders',
  processEmailReminderOutbox: 'waste-management.process-email-reminder-outbox',
  enrichPostalCodes: 'waste-management.enrich-postal-codes',
} as const;

const wasteManagementResetConfirmationToken = 'RESET' as const;

const wasteManagementImportProfileIds = {
  ...wasteManagementDataProfileIds,
  dataPackage: 'waste-management.datenpaket',
  locationTourPickupDates: 'waste-management.ortsbezogene-tourtermine',
} as const;

const wasteManagementImportSourceFormats = [
  'application/json',
  'application/zip',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const wasteManagementExportTargetFormats = ['application/json', 'application/zip'] as const;

const wasteManagementImportUploadMaxBytes = 16 * 1024 * 1024;

const wasteManagementCsvDelimiters = [';', ',', '\t', '|'] as const;

type ValueOf<T> = T[keyof T];

type WasteManagementJobTypeId = ValueOf<typeof wasteManagementJobTypeIds>;
type WasteManagementImportProfileId = ValueOf<typeof wasteManagementImportProfileIds>;
type WasteManagementImportSourceFormat = (typeof wasteManagementImportSourceFormats)[number];
type WasteManagementExportTargetFormat = (typeof wasteManagementExportTargetFormats)[number];
type WasteManagementCsvDelimiter = (typeof wasteManagementCsvDelimiters)[number];

export {
  wasteManagementCsvDelimiters,
  wasteManagementExportTargetFormats,
  wasteManagementImportProfileIds,
  wasteManagementImportSourceFormats,
  wasteManagementImportUploadMaxBytes,
  wasteManagementJobTypeIds,
  wasteManagementResetConfirmationToken,
};
export type {
  WasteManagementCsvDelimiter,
  WasteManagementExportTargetFormat,
  WasteManagementImportProfileId,
  WasteManagementImportSourceFormat,
  WasteManagementJobTypeId,
};
