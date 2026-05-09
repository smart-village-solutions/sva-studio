import type {
  StudioJobEventHostDetails,
  StudioJobProgress,
  StudioJobProgressUpdateInput,
  StudioJobRecord,
} from '@sva/core';

import type { PluginOperationProgressReporter } from './types.js';

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
    readonly hostDetails?: StudioJobEventHostDetails;
    readonly pluginDetails?: Readonly<Record<string, unknown>>;
  }) => Promise<unknown>;
  readonly now?: () => string;
};

export const createJobProgressReporter = (deps: JobProgressReporterDeps): PluginOperationProgressReporter => ({
  reportProgress: async (input) => {
    const updatedAt = input.progress.lastUpdatedAt ?? (deps.now ?? (() => new Date().toISOString()))();
    const progress = {
      ...input.progress,
      lastUpdatedAt: updatedAt,
    } satisfies StudioJobProgress;

    await Promise.all([
      deps.updateJobProgress({
        jobId: input.jobId,
        instanceId: input.instanceId,
        progress,
        lastProgressAt: updatedAt,
        heartbeatAt: updatedAt,
      }),
      deps.appendProgressedEvent({
        jobId: input.jobId,
        instanceId: input.instanceId,
        progress,
        attempts: deps.attempts,
        hostDetails: {
          workerId: deps.workerId,
        },
      }),
    ]);
  },
});
