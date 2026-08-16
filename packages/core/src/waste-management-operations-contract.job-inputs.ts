type WasteManagementProvisionTenantDatabaseJobInput = {
  readonly operation: 'provision-tenant-database';
  readonly desiredGeneration: number;
};

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
  WasteManagementExportTargetFormat,
  WasteManagementImportProfileId,
  WasteManagementImportSourceFormat,
} from './waste-management-operations-contract.constants.js';
import type { WasteManagementDataProfileId } from './waste-management-data-exchange.js';

type WasteManagementImportJobInput = {
  readonly operation: 'import-data';
  readonly importProfileId: WasteManagementImportProfileId;
  readonly sourceFormat: WasteManagementImportSourceFormat;
  readonly dryRun?: boolean;
  readonly blobRef?: string;
  readonly delimiterOverride?: WasteManagementCsvDelimiter;
};

type WasteManagementExportJobInput = {
  readonly operation: 'export-data';
  readonly profileIds: readonly WasteManagementDataProfileId[];
  readonly targetFormat: WasteManagementExportTargetFormat;
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

type WasteManagementEnrichPostalCodesJobInput = {
  readonly operation: 'enrich-postal-codes';
};

export type {
  WasteManagementProvisionTenantDatabaseJobInput,
  WasteManagementApplyMigrationsJobInput,
  WasteManagementExportJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncWasteTypesJobInput,
  WasteManagementEnrichPostalCodesJobInput,
};
