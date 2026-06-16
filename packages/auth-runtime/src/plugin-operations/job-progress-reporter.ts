import type {
  StudioJobEventHostDetails,
  StudioJobProgress,
  StudioJobProgressUpdateInput,
  StudioJobRecord,
} from '@sva/core';

import type { PluginOperationExecutionProgressContext } from './types.js';

type JobProgressReporterDeps = {
  readonly job: Pick<StudioJobRecord, 'id' | 'instanceId'>;
  readonly attempts: number;
  readonly workerId: string;
  readonly updateJobProgress: (input: StudioJobProgressUpdateInput) => Promise<unknown>;
  readonly appendProgressedEvent: (input: {
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress: StudioJobProgress;
    readonly attempts: number;
    readonly message?: string;
    readonly hostDetails?: StudioJobEventHostDetails;
    readonly pluginDetails?: Readonly<Record<string, unknown>>;
  }) => Promise<unknown>;
  readonly onProgressPersisted?: (progress: StudioJobProgress) => void;
  readonly now?: () => string;
};

export const createJobProgressReporter = (
  deps: JobProgressReporterDeps
): PluginOperationExecutionProgressContext => {
  const reportProgress = async (input: {
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress: StudioJobProgress;
  }): Promise<void> => {
    const updatedAt = input.progress.lastUpdatedAt ?? (deps.now ?? (() => new Date().toISOString()))();
    const progress = {
      ...input.progress,
      lastUpdatedAt: updatedAt,
    } satisfies StudioJobProgress;
    deps.onProgressPersisted?.(progress);

    await Promise.all([
      deps.updateJobProgress({
        jobId: deps.job.id,
        instanceId: deps.job.instanceId,
        progress,
        lastProgressAt: updatedAt,
        heartbeatAt: updatedAt,
      }),
      deps.appendProgressedEvent({
        jobId: deps.job.id,
        instanceId: deps.job.instanceId,
        progress,
        attempts: deps.attempts,
        message: progress.currentStepLabel,
        hostDetails: {
          workerId: deps.workerId,
        },
        pluginDetails: progress.details,
      }),
    ]);
  };

  return {
    reportProgress,
    report: async (input) => {
      await reportProgress({
        jobId: deps.job.id,
        instanceId: deps.job.instanceId,
        progress: {
          completedSteps: 0,
          totalSteps: 0,
          currentPhase: input.phaseKey,
          currentStepKey: input.stepKey,
        },
      });
    },
  };
};
