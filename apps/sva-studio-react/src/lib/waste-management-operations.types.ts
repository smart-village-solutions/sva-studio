import type {
  StudioJobProgress,
  StudioJobResultArtifact,
  WasteManagementApplyMigrationsJobInput,
  WasteManagementExportJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementMaterializeEmailRemindersJobInput,
  MailDispatchPayload,
  MailTransportConfig,
  WasteManagementProcessEmailReminderOutboxJobInput,
  WasteManagementProvisionTenantDatabaseJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncMainserverJobInput,
  WasteManagementSyncWasteTypesJobInput,
  WasteManagementEnrichPostalCodesJobInput,
} from '@sva/core';
import type { MailDispatchMessage } from '@sva/mail-runtime';
import type {
  loadDefaultExternalInterfaceRecord,
  listExternalInterfaceRecords,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import type { loadWasteTenantProvisioningRecord } from '@sva/data-repositories/server';

export type SqlClient = {
  query: <TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{
    readonly rowCount: number | null;
    readonly rows: readonly TRow[];
  }>;
  release: () => void;
};

export type WasteOperationSqlPool = {
  connect: () => Promise<SqlClient>;
  end: () => Promise<void>;
};

export type WasteOperationRuntimeDeps = {
  readonly now?: () => Date;
  readonly loadDefaultInterfaceRecord?: typeof loadDefaultExternalInterfaceRecord;
  readonly listInterfaceRecords?: typeof listExternalInterfaceRecords;
  readonly saveInterfaceRecord?: typeof saveExternalInterfaceRecord;
  readonly loadProvisioning?: typeof loadWasteTenantProvisioningRecord;
  readonly revealSecret?: (
    ciphertext: string | null | undefined,
    aad: string
  ) => string | undefined;
  readonly protectSecret?: (plaintext: string, aad: string) => string | null;
  readonly createPool?: (connectionString: string) => WasteOperationSqlPool;
  readonly readBinarySource?: (blobRef: string) => Promise<Uint8Array>;
  readonly storeJobArtifact?: (
    input: Readonly<{
      instanceId: string;
      body: Uint8Array;
      contentType: string;
      fileName: string;
    }>
  ) => Promise<StudioJobResultArtifact>;
  readonly dispatchMail?: (input: {
    readonly instanceId: string;
    readonly transport: MailTransportConfig;
    readonly payload: MailDispatchPayload;
    readonly message: MailDispatchMessage;
  }) => Promise<{
    readonly providerMessageId?: string;
  }>;
  readonly createPostalCodeResolver?: (instanceId: string) => Promise<{
    readonly rateLimitPerMinute: number;
    readonly requestBudget?: number;
    readonly resolve: (query: string) => Promise<
      readonly {
        readonly label: string;
        readonly postalCode?: string;
        readonly city?: string;
        readonly district?: string;
        readonly county?: string;
        readonly state?: string;
        readonly countryCode?: string;
      }[]
    >;
  }>;
  readonly sleep?: (milliseconds: number) => Promise<void>;
};

export type OperationSummary = {
  readonly durationMs: number;
  readonly details: Record<string, unknown>;
  readonly artifacts?: readonly StudioJobResultArtifact[];
};

export type WasteOperationProgressReporter = {
  readonly reportProgress: (progress: StudioJobProgress) => Promise<void> | void;
};

export type WasteManagementOperationRuntime = {
  provisionTenantDatabase: (
    instanceId: string,
    input: WasteManagementProvisionTenantDatabaseJobInput,
    context: { readonly jobId: string }
  ) => Promise<OperationSummary>;
  initializeDataSource: (
    instanceId: string,
    input: WasteManagementInitializeJobInput
  ) => Promise<OperationSummary>;
  applyMigrations: (
    instanceId: string,
    input: WasteManagementApplyMigrationsJobInput
  ) => Promise<OperationSummary>;
  importData: (
    instanceId: string,
    input: WasteManagementImportJobInput,
    progressReporter?: WasteOperationProgressReporter
  ) => Promise<OperationSummary>;
  exportData: (
    instanceId: string,
    input: WasteManagementExportJobInput,
    context: { readonly jobId: string }
  ) => Promise<OperationSummary>;
  seedData: (instanceId: string, input: WasteManagementSeedJobInput) => Promise<OperationSummary>;
  syncMainserver: (
    instanceId: string,
    input: WasteManagementSyncMainserverJobInput,
    progressReporter?: WasteOperationProgressReporter
  ) => Promise<OperationSummary>;
  syncWasteTypes: (
    instanceId: string,
    input: WasteManagementSyncWasteTypesJobInput
  ) => Promise<OperationSummary>;
  enrichPostalCodes: (
    instanceId: string,
    input: WasteManagementEnrichPostalCodesJobInput,
    progressReporter?: WasteOperationProgressReporter,
    context?: { readonly previousProgress?: StudioJobProgress }
  ) => Promise<OperationSummary>;
  materializeEmailReminders: (
    instanceId: string,
    input: WasteManagementMaterializeEmailRemindersJobInput
  ) => Promise<OperationSummary>;
  processEmailReminderOutbox: (
    instanceId: string,
    input: WasteManagementProcessEmailReminderOutboxJobInput
  ) => Promise<OperationSummary>;
  resetData: (instanceId: string, input: WasteManagementResetJobInput) => Promise<OperationSummary>;
};
