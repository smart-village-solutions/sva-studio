import type {
  StudioJobProgress,
  StudioJobResultArtifact,
  MailDispatchPayload,
  MailTransportConfig,
} from '@sva/core';
import type {
  WasteManagementApplyMigrationsJobInput,
  WasteManagementExportJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementMaterializeEmailRemindersJobInput,
  WasteManagementProcessEmailReminderOutboxJobInput,
  WasteManagementProvisionTenantDatabaseJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncMainserverJobInput,
  WasteManagementSyncWasteTypesJobInput,
  WasteManagementEnrichPostalCodesJobInput,
  WasteMainserverSyncItem,
  WasteMainserverSyncSnapshot,
} from '@sva/waste-management-contracts';
import type { MailDispatchMessage } from '@sva/mail-runtime';
import type {
  loadDefaultExternalInterfaceRecord,
  loadExternalInterfaceRecordByAlias,
  listExternalInterfaceRecords,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';
import type { WasteProvisioningAccess, WasteProvisioningDbClient } from '../repositories/waste-provisioning.js';
import type { PluginTenantLifecycleExecutionResult } from '@sva/plugin-sdk';

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
  readonly withInstanceDb?: <T>(
    instanceId: string,
    work: (client: WasteProvisioningDbClient) => Promise<T>
  ) => Promise<T>;
  readonly loadProvisioning?: WasteProvisioningAccess['loadWasteTenantProvisioningRecord'];
  readonly requestProvisioning?: WasteProvisioningAccess['requestWasteTenantProvisioning'];
  readonly claimProvisioning?: WasteProvisioningAccess['claimWasteTenantProvisioning'];
  readonly completeProvisioning?: WasteProvisioningAccess['completeWasteTenantProvisioning'];
  readonly failProvisioning?: WasteProvisioningAccess['failWasteTenantProvisioning'];
  readonly suspendProvisioning?: (instanceId: string) => Promise<unknown>;
  readonly loadManagedInterface?: typeof loadExternalInterfaceRecordByAlias;
  readonly checkSchema?: (instanceId: string) => Promise<boolean>;
  readonly getProvisionerDatabaseUrl?: () => string | undefined;
  readonly listMainserverWasteSyncSnapshot?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
  }) => Promise<WasteMainserverSyncSnapshot>;
  readonly createMainserverWastePickupTimes?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
    readonly items: readonly WasteMainserverSyncItem[];
  }) => Promise<unknown>;
  readonly deleteMainserverWastePickupTimes?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
    readonly items: readonly WasteMainserverSyncItem[];
  }) => Promise<unknown>;
  readonly writeWasteStaticContent?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly activeOrganizationId?: string;
    readonly staticContent: Readonly<{ name: string; content: string }>;
  }) => Promise<Readonly<{ id: string }>>;
  readonly revealSecret?: (
    ciphertext: string | null | undefined,
    aad: string
  ) => string | undefined;
  readonly protectSecret?: (plaintext: string, aad: string) => string | null;
  readonly createPool?: (connectionString: string) => WasteOperationSqlPool;
  readonly readBinarySource?: (blobRef: string) => Promise<Uint8Array>;
  readonly readPluginOperationInput?: (input: {
    readonly instanceId: string;
    readonly blobRef: string;
  }) => Promise<{ readonly body: Uint8Array }>;
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
  requestTenantDatabaseProvisioning: (
    instanceId: string
  ) => Promise<{ readonly desiredGeneration: number }>;
  suspendTenantDatabaseProvisioning: (instanceId: string) => Promise<unknown>;
  readTenantDatabaseReadiness: (
    instanceId: string
  ) => Promise<PluginTenantLifecycleExecutionResult>;
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
