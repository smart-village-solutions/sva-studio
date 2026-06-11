import type {
  StudioJobProgress,
  WasteManagementApplyMigrationsJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncWasteTypesJobInput,
} from '@sva/core';
import type { loadDefaultExternalInterfaceRecord, listExternalInterfaceRecords } from '@sva/data-repositories/server';

type WasteManagementSyncMainserverJobInput = Extract<
  WasteManagementJobInput,
  { readonly operation: 'sync-mainserver' }
>;

export type SqlClient = {
  query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{
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
  readonly revealSecret?: (ciphertext: string | null | undefined, aad: string) => string | undefined;
  readonly createPool?: (connectionString: string) => WasteOperationSqlPool;
  readonly readBinarySource?: (blobRef: string) => Promise<Uint8Array>;
};

export type OperationSummary = {
  readonly durationMs: number;
  readonly details: Record<string, unknown>;
};

export type WasteImportProgressReporter = {
  readonly reportProgress: (progress: StudioJobProgress) => Promise<void> | void;
};

export type WasteManagementOperationRuntime = {
  initializeDataSource: (instanceId: string, input: WasteManagementInitializeJobInput) => Promise<OperationSummary>;
  applyMigrations: (instanceId: string, input: WasteManagementApplyMigrationsJobInput) => Promise<OperationSummary>;
  importData: (
    instanceId: string,
    input: WasteManagementImportJobInput,
    progressReporter?: WasteImportProgressReporter
  ) => Promise<OperationSummary>;
  seedData: (instanceId: string, input: WasteManagementSeedJobInput) => Promise<OperationSummary>;
  syncMainserver: (instanceId: string, input: WasteManagementSyncMainserverJobInput) => Promise<OperationSummary>;
  syncWasteTypes: (instanceId: string, input: WasteManagementSyncWasteTypesJobInput) => Promise<OperationSummary>;
  resetData: (instanceId: string, input: WasteManagementResetJobInput) => Promise<OperationSummary>;
};
