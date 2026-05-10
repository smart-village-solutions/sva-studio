import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';
import {
  wasteManagementOperationsContract,
  type WasteManagementApplyMigrationsJobInput,
  type WasteManagementImportJobInput,
  type WasteManagementInitializeJobInput,
  type WasteManagementJobInput,
  type WasteManagementResetJobInput,
  type WasteManagementSeedJobInput,
} from '@sva/core';

const createProgress = (input: {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly currentPhase: string;
  readonly currentStepKey: string;
}) => ({
  completedSteps: input.completedSteps,
  totalSteps: input.totalSteps,
  currentPhase: input.currentPhase,
  currentStepKey: input.currentStepKey,
  lastUpdatedAt: new Date().toISOString(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const assertWasteJobInput = <TJobInput extends WasteManagementJobInput>(
  jobTypeId: string,
  inputPayload: Readonly<Record<string, unknown>>,
  expectedOperation: TJobInput['operation']
): TJobInput => {
  if (isRecord(inputPayload) && inputPayload.operation === expectedOperation) {
    return inputPayload as TJobInput;
  }

  throw new Error(`invalid_waste_management_job_input:${jobTypeId}`);
};

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
    payload: WasteManagementImportJobInput
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
};

const createOperationHandler = <TJobInput extends WasteManagementJobInput>(input: {
  readonly jobTypeId: string;
  readonly expectedOperation: TJobInput['operation'];
  readonly phaseKey: string;
  readonly execute: (
    runtime: WasteManagementOperationRuntime,
    instanceId: string,
    payload: TJobInput
  ) => Promise<{
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  }>;
}) =>
  (runtime: WasteManagementOperationRuntime): PluginJobExecutionHandler =>
  async (context) => {
    const payload = assertWasteJobInput<TJobInput>(input.jobTypeId, context.job.inputPayload, input.expectedOperation);
    const startedAt = Date.now();

    await context.throwIfCancellationRequested();
    await context.progressReporter.reportProgress({
      jobId: context.job.id,
      instanceId: context.job.instanceId,
      progress: createProgress({
        completedSteps: 1,
        totalSteps: 2,
        currentPhase: input.phaseKey,
        currentStepKey: 'resolve-operation',
      }),
    });

    await context.throwIfCancellationRequested();
    const operationResult = await input.execute(runtime, context.job.instanceId, payload);
    await context.throwIfCancellationRequested();
    const progress = createProgress({
      completedSteps: 2,
      totalSteps: 2,
      currentPhase: 'waste-management.completed',
      currentStepKey: 'complete-operation',
    });

    await context.progressReporter.reportProgress({
      jobId: context.job.id,
      instanceId: context.job.instanceId,
      progress,
    });

    return {
      progress,
      resultPayload: {
        summary: {
          durationMs: Math.max(operationResult.durationMs, Math.max(1, Date.now() - startedAt)),
        },
        plugin: {
          operation: payload.operation,
          mode: 'executed',
          ...operationResult.details,
        },
      },
    };
  };

export const createWasteManagementPluginOperationExecutionHandlers = (
  runtime: WasteManagementOperationRuntime
): Readonly<Record<string, PluginJobExecutionHandler>> => ({
  [wasteManagementOperationsContract.jobTypeIds.initializeDataSource]:
    createOperationHandler<WasteManagementInitializeJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
      expectedOperation: 'initialize-data-source',
      phaseKey: 'waste-management.initialize',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.initializeDataSource(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.applyMigrations]:
    createOperationHandler<WasteManagementApplyMigrationsJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
      expectedOperation: 'apply-migrations',
      phaseKey: 'waste-management.migrations',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.applyMigrations(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.importData]:
    createOperationHandler<WasteManagementImportJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
      expectedOperation: 'import-data',
      phaseKey: 'mapping',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.importData(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.seedData]:
    createOperationHandler<WasteManagementSeedJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
      expectedOperation: 'seed-data',
      phaseKey: 'waste-management.seed',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.seedData(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.resetData]:
    createOperationHandler<WasteManagementResetJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
      expectedOperation: 'reset-data',
      phaseKey: 'waste-management.reset',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.resetData(instanceId, payload),
    })(runtime),
});

export const createPluginJobExecutionHandlers = createWasteManagementPluginOperationExecutionHandlers;
