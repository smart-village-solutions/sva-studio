import type { WasteManagementSyncMainserverJobInput } from './waste-management-sync-mainserver-job-input.js';

const wasteManagementJobTypeIds = {
  initializeDataSource: 'waste-management.initialize-data-source',
  applyMigrations: 'waste-management.apply-migrations',
  importData: 'waste-management.import-data',
  seedData: 'waste-management.seed-data',
  resetData: 'waste-management.reset-data',
  syncMainserver: 'waste-management.sync-mainserver',
  syncWasteTypes: 'waste-management.sync-waste-types',
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

export type WasteManagementJobTypeId = ValueOf<typeof wasteManagementJobTypeIds>;
export type WasteManagementImportProfileId = ValueOf<typeof wasteManagementImportProfileIds>;
export type WasteManagementImportSourceFormat = (typeof wasteManagementImportSourceFormats)[number];
export type WasteManagementCsvDelimiter = (typeof wasteManagementCsvDelimiters)[number];

export type WasteManagementInitializeJobInput = {
  readonly operation: 'initialize-data-source';
  readonly targetSchema?: string;
};

export type WasteManagementApplyMigrationsJobInput = {
  readonly operation: 'apply-migrations';
  readonly targetSchema?: string;
  readonly requestedByVersion?: string;
};

export type WasteManagementImportJobInput = {
  readonly operation: 'import-data';
  readonly importProfileId: WasteManagementImportProfileId;
  readonly sourceFormat: WasteManagementImportSourceFormat;
  readonly dryRun?: boolean;
  readonly blobRef?: string;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
};

export type WasteManagementSeedJobInput = {
  readonly operation: 'seed-data';
  readonly seedKey: 'baseline';
};

export type WasteManagementResetJobInput = {
  readonly operation: 'reset-data';
  readonly confirmationToken: string;
};

export type WasteManagementSyncWasteTypesJobInput = {
  readonly operation: 'sync-waste-types';
  readonly keycloakSubject?: string;
  readonly activeOrganizationId?: string;
};

export type WasteManagementJobInput =
  | WasteManagementInitializeJobInput
  | WasteManagementApplyMigrationsJobInput
  | WasteManagementImportJobInput
  | WasteManagementSeedJobInput
  | WasteManagementResetJobInput
  | WasteManagementSyncMainserverJobInput
  | WasteManagementSyncWasteTypesJobInput;

export const wasteManagementOperationsContract = {
  pluginId: 'waste-management',
  queueName: 'plugin-operations',
  jobTypeIds: wasteManagementJobTypeIds,
  resetConfirmationToken: wasteManagementResetConfirmationToken,
  importProfileIds: wasteManagementImportProfileIds,
  importSourceFormats: wasteManagementImportSourceFormats,
  csvDelimiters: wasteManagementCsvDelimiters,
  isJobTypeId: (value: string): value is WasteManagementJobTypeId =>
    (Object.values(wasteManagementJobTypeIds) as readonly string[]).includes(value),
  isImportProfileId: (value: string): value is WasteManagementImportProfileId =>
    (Object.values(wasteManagementImportProfileIds) as readonly string[]).includes(value),
  isImportSourceFormat: (value: string): value is WasteManagementImportSourceFormat =>
    (wasteManagementImportSourceFormats as readonly string[]).includes(value),
  isCsvDelimiter: (value: string): value is WasteManagementCsvDelimiter =>
    (wasteManagementCsvDelimiters as readonly string[]).includes(value),
} as const;
