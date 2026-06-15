const wasteManagementJobTypeIds = {
  initializeDataSource: 'waste-management.initialize-data-source',
  applyMigrations: 'waste-management.apply-migrations',
  importData: 'waste-management.import-data',
  seedData: 'waste-management.seed-data',
  resetData: 'waste-management.reset-data',
  syncMainserver: 'waste-management.sync-mainserver',
  syncWasteTypes: 'waste-management.sync-waste-types',
  materializeEmailReminders: 'waste-management.materialize-email-reminders',
  processEmailReminderOutbox: 'waste-management.process-email-reminder-outbox',
} as const;

const wasteManagementResetConfirmationToken = 'RESET' as const;

const wasteManagementImportProfileIds = {
  geographyCollectionLocations: 'waste-management.geografie-abholorte',
  tours: 'waste-management.touren',
  dateShifts: 'waste-management.ausweichtermine',
  locationTourPickupDates: 'waste-management.ortsbezogene-tourtermine',
} as const;

const wasteManagementImportSourceFormats = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const wasteManagementCsvDelimiters = [';', ',', '\t', '|'] as const;

type ValueOf<T> = T[keyof T];

type WasteManagementJobTypeId = ValueOf<typeof wasteManagementJobTypeIds>;
type WasteManagementImportProfileId = ValueOf<typeof wasteManagementImportProfileIds>;
type WasteManagementImportSourceFormat = (typeof wasteManagementImportSourceFormats)[number];
type WasteManagementCsvDelimiter = (typeof wasteManagementCsvDelimiters)[number];

export {
  wasteManagementCsvDelimiters,
  wasteManagementImportProfileIds,
  wasteManagementImportSourceFormats,
  wasteManagementJobTypeIds,
  wasteManagementResetConfirmationToken,
};
export type {
  WasteManagementCsvDelimiter,
  WasteManagementImportProfileId,
  WasteManagementImportSourceFormat,
  WasteManagementJobTypeId,
};
