import type {
  WasteManagementApplyMigrationsJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
} from '@sva/core';
import type { loadWasteDataSourceRecord } from '@sva/data-repositories/server';

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
  readonly loadDataSourceRecord?: typeof loadWasteDataSourceRecord;
  readonly revealSecret?: (ciphertext: string | null | undefined, aad: string) => string | undefined;
  readonly createPool?: (connectionString: string) => WasteOperationSqlPool;
  readonly readBinarySource?: (blobRef: string) => Promise<Uint8Array>;
};

export type OperationSummary = {
  readonly durationMs: number;
  readonly details: Record<string, unknown>;
};

export type WasteManagementOperationRuntime = {
  initializeDataSource: (instanceId: string, input: WasteManagementInitializeJobInput) => Promise<OperationSummary>;
  applyMigrations: (instanceId: string, input: WasteManagementApplyMigrationsJobInput) => Promise<OperationSummary>;
  importData: (instanceId: string, input: WasteManagementImportJobInput) => Promise<OperationSummary>;
  seedData: (instanceId: string, input: WasteManagementSeedJobInput) => Promise<OperationSummary>;
  resetData: (instanceId: string, input: WasteManagementResetJobInput) => Promise<OperationSummary>;
};
