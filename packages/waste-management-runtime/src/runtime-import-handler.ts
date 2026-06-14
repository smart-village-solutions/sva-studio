import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';
import { wasteManagementOperationsContract, type WasteManagementImportJobInput } from '@sva/plugin-sdk';

import {
  assertWasteJobInput,
  createOperationResult,
  getJobTypeDefinition,
  getProgressDefinition,
} from './runtime-job-helpers.js';
import { createProgress, type WasteManagementJobProgress, type WasteManagementOperationRuntime } from './runtime-types.js';

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

const reportImportProgress = async (
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
  await reportImportProgress(
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

  await reportImportProgress(context, finalProgress, useRuntimeManagedProgress);

  return createOperationResult({
    jobTypeDefinition,
    payload,
    operationResult,
    startedAt,
    progress: finalProgress,
  });
};
