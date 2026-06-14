import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';
import {
  type PluginJobTypeDefinition,
  wasteManagementOperationsContract,
  type WasteManagementApplyMigrationsJobInput,
  type WasteManagementImportJobInput,
  type WasteManagementInitializeJobInput,
  type WasteManagementJobInput,
  type WasteManagementResetJobInput,
  type WasteManagementSeedJobInput,
  type WasteManagementSyncMainserverJobInput,
  type WasteManagementSyncWasteTypesJobInput,
} from '@sva/plugin-sdk';
import { createWasteManagementPluginJobTypes } from '@sva/plugin-waste-management/waste-management.job-definitions';

import { createProgress, type WasteManagementJobProgress, type WasteManagementOperationRuntime } from './runtime-types.js';

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

const jobTypeDefinitionsById = new Map<string, PluginJobTypeDefinition>(
  createWasteManagementPluginJobTypes().map((jobType) => [jobType.jobTypeId, jobType])
);

const getJobTypeDefinition = (jobTypeId: string): PluginJobTypeDefinition => {
  const definition = jobTypeDefinitionsById.get(jobTypeId);
  if (!definition) {
    throw new Error(`unknown_waste_management_job_type:${jobTypeId}`);
  }
  return definition;
};

const pickDeclaredDetailKeys = (
  details: Readonly<Record<string, unknown>>,
  detailKeys: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(
    detailKeys
      .filter((detailKey) => Object.prototype.hasOwnProperty.call(details, detailKey))
      .map((detailKey) => [detailKey, details[detailKey]])
  );

const getProgressDefinition = (
  jobTypeDefinition: PluginJobTypeDefinition,
  fallbackPhaseKey: string
) => {
  const phaseKeys = jobTypeDefinition.progress?.phaseKeys ?? [fallbackPhaseKey, 'waste-management.completed'];
  const stepKeys = jobTypeDefinition.progress?.stepKeys ?? ['resolve-operation', 'complete-operation'];

  return {
    initialPhaseKey: phaseKeys[0] ?? fallbackPhaseKey,
    initialStepKey: stepKeys[0] ?? 'resolve-operation',
    completedPhaseKey: phaseKeys[phaseKeys.length - 1] ?? 'waste-management.completed',
    completedStepKey: stepKeys[stepKeys.length - 1] ?? 'complete-operation',
  };
};

const createOperationResult = <TJobInput extends WasteManagementJobInput>(input: {
  readonly jobTypeDefinition: PluginJobTypeDefinition;
  readonly payload: TJobInput;
  readonly operationResult: {
    readonly durationMs: number;
    readonly details: Record<string, unknown>;
  };
  readonly startedAt: number;
  readonly progress: WasteManagementJobProgress;
}) => ({
  progress: input.progress,
  resultPayload: {
    summary: {
      durationMs: Math.max(input.operationResult.durationMs, Math.max(1, Date.now() - input.startedAt)),
    },
    plugin: {
      operation: input.payload.operation,
      mode: 'executed',
      ...pickDeclaredDetailKeys(input.operationResult.details, input.jobTypeDefinition.result?.detailKeys ?? []),
    },
  },
});

export const createOperationHandler = <TJobInput extends WasteManagementJobInput>(input: {
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
    const jobTypeDefinition = getJobTypeDefinition(input.jobTypeId);
    const { initialPhaseKey, initialStepKey, completedPhaseKey, completedStepKey } = getProgressDefinition(
      jobTypeDefinition,
      input.phaseKey
    );
    const payload = assertWasteJobInput<TJobInput>(input.jobTypeId, context.job.inputPayload, input.expectedOperation);
    const startedAt = Date.now();

    await context.throwIfCancellationRequested();
    await context.progressReporter.reportProgress({
      jobId: context.job.id,
      instanceId: context.job.instanceId,
      progress: createProgress({
        completedSteps: 1,
        totalSteps: 2,
        currentPhase: initialPhaseKey,
        currentStepKey: initialStepKey,
      }),
    });

    await context.throwIfCancellationRequested();
    const operationResult = await input.execute(runtime, context.job.instanceId, payload);
    await context.throwIfCancellationRequested();
    const progress = createProgress({
      completedSteps: 2,
      totalSteps: 2,
      currentPhase: completedPhaseKey,
      currentStepKey: completedStepKey,
    });

    await context.progressReporter.reportProgress({
      jobId: context.job.id,
      instanceId: context.job.instanceId,
      progress,
    });

    return createOperationResult({
      jobTypeDefinition,
      payload,
      operationResult,
      startedAt,
      progress,
    });
  };

const shouldUseRuntimeManagedImportProgress = (payload: WasteManagementImportJobInput) =>
  payload.importProfileId === wasteManagementOperationsContract.importProfileIds.locationTourPickupDates &&
  payload.sourceFormat === 'text/csv' &&
  !payload.dryRun;

const createImportProgressReporter = (
  context: Parameters<PluginJobExecutionHandler>[0],
  onProgress: (progress: WasteManagementJobProgress) => void
) => ({
  reportProgress: async (progress: WasteManagementJobProgress) => {
    onProgress(progress);
    await context.progressReporter.reportProgress({
      jobId: context.job.id,
      instanceId: context.job.instanceId,
      progress,
    });
  },
});

const reportInitialImportProgress = async (
  context: Parameters<PluginJobExecutionHandler>[0],
  progress: WasteManagementJobProgress,
  useRuntimeManagedProgress: boolean
) => {
  if (useRuntimeManagedProgress) {
    return;
  }

  await context.progressReporter.reportProgress({
    jobId: context.job.id,
    instanceId: context.job.instanceId,
    progress,
  });
};

const reportFinalImportProgress = async (
  context: Parameters<PluginJobExecutionHandler>[0],
  progress: WasteManagementJobProgress,
  useRuntimeManagedProgress: boolean
) => {
  if (useRuntimeManagedProgress) {
    return;
  }

  await context.progressReporter.reportProgress({
    jobId: context.job.id,
    instanceId: context.job.instanceId,
    progress,
  });
};

export const createImportDataHandler = (runtime: WasteManagementOperationRuntime): PluginJobExecutionHandler => async (context) => {
  const jobTypeDefinition = getJobTypeDefinition(wasteManagementOperationsContract.jobTypeIds.importData);
  const { initialPhaseKey, initialStepKey, completedPhaseKey, completedStepKey } = getProgressDefinition(
    jobTypeDefinition,
    'mapping'
  );
  const payload = assertWasteJobInput<WasteManagementImportJobInput>(
    wasteManagementOperationsContract.jobTypeIds.importData,
    context.job.inputPayload,
    'import-data'
  );
  const startedAt = Date.now();
  const useRuntimeManagedProgress = shouldUseRuntimeManagedImportProgress(payload);
  let latestRuntimeProgress: WasteManagementJobProgress | undefined;

  await context.throwIfCancellationRequested();
  await reportInitialImportProgress(
    context,
    createProgress({
      completedSteps: 1,
      totalSteps: 2,
      currentPhase: initialPhaseKey,
      currentStepKey: initialStepKey,
    }),
    useRuntimeManagedProgress
  );

  await context.throwIfCancellationRequested();
  const operationResult = await runtime.importData(
    context.job.instanceId,
    payload,
    useRuntimeManagedProgress
      ? createImportProgressReporter(context, (progress) => {
          latestRuntimeProgress = progress;
        })
      : undefined
  );
  await context.throwIfCancellationRequested();

  const finalProgress =
    latestRuntimeProgress ??
    createProgress({
      completedSteps: 2,
      totalSteps: 2,
      currentPhase: completedPhaseKey,
      currentStepKey: completedStepKey,
    });

  await reportFinalImportProgress(context, finalProgress, useRuntimeManagedProgress);

  return createOperationResult({
    jobTypeDefinition,
    payload,
    operationResult,
    startedAt,
    progress: finalProgress,
  });
};

export const createWasteRuntimeOperationHandlers = (runtime: WasteManagementOperationRuntime) => ({
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
  [wasteManagementOperationsContract.jobTypeIds.importData]: createImportDataHandler(runtime),
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
  [wasteManagementOperationsContract.jobTypeIds.syncMainserver]:
    createOperationHandler<WasteManagementSyncMainserverJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncMainserver,
      expectedOperation: 'sync-mainserver',
      phaseKey: 'waste-management.mainserver-sync',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.syncMainserver(instanceId, payload),
    })(runtime),
  [wasteManagementOperationsContract.jobTypeIds.syncWasteTypes]:
    createOperationHandler<WasteManagementSyncWasteTypesJobInput>({
      jobTypeId: wasteManagementOperationsContract.jobTypeIds.syncWasteTypes,
      expectedOperation: 'sync-waste-types',
      phaseKey: 'waste-management.sync-waste-types',
      execute: (runtimeArg, instanceId, payload) => runtimeArg.syncWasteTypes(instanceId, payload),
    })(runtime),
});
