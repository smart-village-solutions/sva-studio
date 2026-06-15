type WasteManagementInitializeJobInput = {
  readonly operation: 'initialize-data-source';
  readonly targetSchema?: string;
};

type WasteManagementApplyMigrationsJobInput = {
  readonly operation: 'apply-migrations';
  readonly targetSchema?: string;
  readonly requestedByVersion?: string;
};

import type {
  WasteManagementCsvDelimiter,
  WasteManagementImportProfileId,
  WasteManagementImportSourceFormat,
} from './waste-management-operations-contract.constants.js';

type WasteManagementImportJobInput = {
  readonly operation: 'import-data';
  readonly importProfileId: WasteManagementImportProfileId;
  readonly sourceFormat: WasteManagementImportSourceFormat;
  readonly dryRun?: boolean;
  readonly blobRef?: string;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
};

type WasteManagementSeedJobInput = {
  readonly operation: 'seed-data';
  readonly seedKey: 'baseline';
};

type WasteManagementResetJobInput = {
  readonly operation: 'reset-data';
  readonly confirmationToken: string;
};

type WasteManagementSyncWasteTypesJobInput = {
  readonly operation: 'sync-waste-types';
  readonly keycloakSubject?: string;
  readonly activeOrganizationId?: string;
};

export type {
  WasteManagementApplyMigrationsJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncWasteTypesJobInput,
};
