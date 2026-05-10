const wasteManagementJobTypeIds = {
  initializeDataSource: 'waste-management.initialize-data-source',
  applyMigrations: 'waste-management.apply-migrations',
  importData: 'waste-management.import-data',
  seedData: 'waste-management.seed-data',
  resetData: 'waste-management.reset-data',
} as const;

const wasteManagementImportProfileIds = {
  geographyCollectionLocations: 'waste-management.geografie-abholorte',
  tours: 'waste-management.touren',
  dateShifts: 'waste-management.ausweichtermine',
} as const;

const wasteManagementImportSourceFormats = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

type ValueOf<T> = T[keyof T];

export type WasteManagementJobTypeId = ValueOf<typeof wasteManagementJobTypeIds>;
export type WasteManagementImportProfileId = ValueOf<typeof wasteManagementImportProfileIds>;
export type WasteManagementImportSourceFormat = (typeof wasteManagementImportSourceFormats)[number];

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
};

export type WasteManagementSeedJobInput = {
  readonly operation: 'seed-data';
  readonly seedKey: 'baseline';
};

export type WasteManagementResetJobInput = {
  readonly operation: 'reset-data';
  readonly confirmationToken: string;
};

export type WasteManagementJobInput =
  | WasteManagementInitializeJobInput
  | WasteManagementApplyMigrationsJobInput
  | WasteManagementImportJobInput
  | WasteManagementSeedJobInput
  | WasteManagementResetJobInput;

export const wasteManagementOperationsContract = {
  pluginId: 'waste-management',
  queueName: 'plugin-operations',
  jobTypeIds: wasteManagementJobTypeIds,
  importProfileIds: wasteManagementImportProfileIds,
  importSourceFormats: wasteManagementImportSourceFormats,
  isJobTypeId: (value: string): value is WasteManagementJobTypeId =>
    (Object.values(wasteManagementJobTypeIds) as readonly string[]).includes(value),
  isImportProfileId: (value: string): value is WasteManagementImportProfileId =>
    (Object.values(wasteManagementImportProfileIds) as readonly string[]).includes(value),
  isImportSourceFormat: (value: string): value is WasteManagementImportSourceFormat =>
    (wasteManagementImportSourceFormats as readonly string[]).includes(value),
} as const;
