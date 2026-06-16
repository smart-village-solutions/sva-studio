import type { PluginJobExecutionHandler } from '@sva/plugin-sdk';

import { createProgress, type WasteManagementJobProgress } from './runtime-types.js';

type WasteJobContext = Parameters<PluginJobExecutionHandler>[0];

export const createRuntimeProgressReporter = (
  context: WasteJobContext,
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

export const reportJobProgress = async (
  context: WasteJobContext,
  progress: WasteManagementJobProgress,
  useRuntimeManagedProgress: boolean
): Promise<void> => {
  if (useRuntimeManagedProgress) {
    return;
  }

  await context.progressReporter.reportProgress({
    jobId: context.job.id,
    instanceId: context.job.instanceId,
    progress,
  });
};

export const createInitialJobProgress = (input: {
  readonly stepCount: number;
  readonly initialPhaseKey: string;
  readonly initialStepKey: string;
}): WasteManagementJobProgress =>
  createProgress({
    completedSteps: 1,
    totalSteps: input.stepCount,
    currentPhase: input.initialPhaseKey,
    currentStepKey: input.initialStepKey,
  });

export const createCompletedJobProgress = (input: {
  readonly stepCount: number;
  readonly completedPhaseKey: string;
  readonly completedStepKey: string;
}): WasteManagementJobProgress =>
  createProgress({
    completedSteps: input.stepCount,
    totalSteps: input.stepCount,
    currentPhase: input.completedPhaseKey,
    currentStepKey: input.completedStepKey,
  });
