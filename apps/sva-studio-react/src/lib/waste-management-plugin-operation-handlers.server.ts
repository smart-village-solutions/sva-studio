import type { PluginOperationExecutionHandler } from '@sva/auth-runtime/server';
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

const createPlaceholderHandler = <TJobInput extends WasteManagementJobInput>(input: {
  readonly jobTypeId: string;
  readonly expectedOperation: TJobInput['operation'];
  readonly phaseKey: string;
}): PluginOperationExecutionHandler => async (context) => {
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
        durationMs: Math.max(1, Date.now() - startedAt),
      },
      plugin: {
        operation: payload.operation,
        mode: 'placeholder',
      },
    },
  };
};

export const createWasteManagementPluginOperationExecutionHandlers = (): Readonly<
  Record<string, PluginOperationExecutionHandler>
> => ({
  [wasteManagementOperationsContract.jobTypeIds.initializeDataSource]: createPlaceholderHandler<WasteManagementInitializeJobInput>(
    {
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.initializeDataSource,
      expectedOperation: 'initialize-data-source',
      phaseKey: 'waste-management.initialize',
    }
  ),
  [wasteManagementOperationsContract.jobTypeIds.applyMigrations]: createPlaceholderHandler<WasteManagementApplyMigrationsJobInput>(
    {
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.applyMigrations,
      expectedOperation: 'apply-migrations',
      phaseKey: 'waste-management.migrations',
    }
  ),
  [wasteManagementOperationsContract.jobTypeIds.importData]: createPlaceholderHandler<WasteManagementImportJobInput>({
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.importData,
    expectedOperation: 'import-data',
    phaseKey: 'mapping',
  }),
  [wasteManagementOperationsContract.jobTypeIds.seedData]: createPlaceholderHandler<WasteManagementSeedJobInput>({
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.seedData,
    expectedOperation: 'seed-data',
    phaseKey: 'waste-management.seed',
  }),
  [wasteManagementOperationsContract.jobTypeIds.resetData]: createPlaceholderHandler<WasteManagementResetJobInput>({
    jobTypeId: wasteManagementOperationsContract.jobTypeIds.resetData,
    expectedOperation: 'reset-data',
    phaseKey: 'waste-management.reset',
  }),
});
