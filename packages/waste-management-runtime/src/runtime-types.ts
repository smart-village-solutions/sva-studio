import type {
  WasteManagementApplyMigrationsJobInput,
  WasteManagementImportJobInput,
  WasteManagementInitializeJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncMainserverJobInput,
  WasteManagementSyncWasteTypesJobInput,
} from '@sva/plugin-sdk';

export const createProgress = (input: {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly currentPhase: string;
  readonly currentStepKey: string;
  readonly details?: Readonly<Record<string, unknown>>;
}) => ({
  completedSteps: input.completedSteps,
  totalSteps: input.totalSteps,
  currentPhase: input.currentPhase,
  currentStepKey: input.currentStepKey,
  details: input.details,
  lastUpdatedAt: new Date().toISOString(),
});

export type WasteManagementJobProgress = ReturnType<typeof createProgress>;

export type WasteManagementOperationRuntime = {
  readonly initializeDataSource: (
    instanceId: string,
    payload: WasteManagementInitializeJobInput
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
  readonly applyMigrations: (
    instanceId: string,
    payload: WasteManagementApplyMigrationsJobInput
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
  readonly importData: (
    instanceId: string,
    payload: WasteManagementImportJobInput,
    progressReporter?: {
      readonly reportProgress: (progress: WasteManagementJobProgress) => Promise<void> | void;
    }
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
  readonly seedData: (
    instanceId: string,
    payload: WasteManagementSeedJobInput
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
  readonly resetData: (
    instanceId: string,
    payload: WasteManagementResetJobInput
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
  readonly syncMainserver: (
    instanceId: string,
    payload: WasteManagementSyncMainserverJobInput
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
  readonly syncWasteTypes: (
    instanceId: string,
    payload: WasteManagementSyncWasteTypesJobInput
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
};
