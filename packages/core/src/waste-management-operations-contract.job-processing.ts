import type { WasteManagementSyncMainserverJobInput } from './waste-management-sync-mainserver-job-input.js';

import type {
  WasteManagementApplyMigrationsJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementProvisionTenantDatabaseJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncWasteTypesJobInput,
} from './waste-management-operations-contract.job-inputs.js';

type WasteManagementMaterializeEmailRemindersJobInput = {
  readonly operation: 'materialize-email-reminders';
  readonly referenceTime?: string;
};

type WasteManagementProcessEmailReminderOutboxJobInput = {
  readonly operation: 'process-email-reminder-outbox';
  readonly referenceTime?: string;
  readonly maxBatchSize?: number;
  readonly maxAttempts?: number;
  readonly retryDelayMinutes?: number;
};

type WasteManagementJobInput =
  | WasteManagementProvisionTenantDatabaseJobInput
  | WasteManagementInitializeJobInput
  | WasteManagementApplyMigrationsJobInput
  | WasteManagementImportJobInput
  | WasteManagementSeedJobInput
  | WasteManagementResetJobInput
  | WasteManagementSyncMainserverJobInput
  | WasteManagementSyncWasteTypesJobInput
  | WasteManagementMaterializeEmailRemindersJobInput
  | WasteManagementProcessEmailReminderOutboxJobInput;

export type {
  WasteManagementJobInput,
  WasteManagementMaterializeEmailRemindersJobInput,
  WasteManagementProcessEmailReminderOutboxJobInput,
};
