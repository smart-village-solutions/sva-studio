import type {
  StudioJobError,
  StudioJobEventHostDetails,
  StudioJobRecord,
  StudioJobUpdateInput,
} from '@sva/core';

import type { PluginOperationExecutionResult } from './types.js';

type JobStateWriterDeps = {
  readonly updateJobState: (input: StudioJobUpdateInput) => Promise<unknown>;
  readonly appendStartedEvent: (input: {
    readonly eventType?: 'job.started';
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendSucceededEvent: (input: {
    readonly eventType?: 'job.succeeded';
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendRetriedEvent: (input: {
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly errorPayload: StudioJobError;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendFailedEvent: (input: {
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly errorPayload?: StudioJobError;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendCancelledEvent?: (input: {
    readonly eventType?: 'job.cancelled';
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly message?: string;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly now?: () => string;
};

type BaseStateInput = {
  readonly job: StudioJobRecord;
  readonly attempts: number;
  readonly startedAt: string;
  readonly workerId: string;
};

const getNow = (deps: JobStateWriterDeps): string => (deps.now ?? (() => new Date().toISOString()))();

export const createJobStateWriter = (deps: JobStateWriterDeps) => ({
  markRunning: async ({ job, attempts, startedAt, workerId }: BaseStateInput): Promise<void> => {
    await Promise.all([
      deps.updateJobState({
        jobId: job.id,
        instanceId: job.instanceId,
        status: 'running',
        attempts,
        startedAt: job.startedAt ?? startedAt,
        progress: job.progress,
        workerId,
        heartbeatAt: startedAt,
      }),
      deps.appendStartedEvent({
        eventType: 'job.started',
        jobId: job.id,
        instanceId: job.instanceId,
        progress: job.progress,
        attempts,
        hostDetails: {
          workerId,
        },
      }),
    ]);
  },

  markSucceeded: async ({
    job,
    attempts,
    startedAt,
    workerId,
    result,
  }: BaseStateInput & { readonly result: PluginOperationExecutionResult | void }): Promise<void> => {
    const completedAt = getNow(deps);
    const progress = result?.progress ?? {
      completedSteps: 1,
      totalSteps: 1,
      currentPhase: 'completed',
      lastUpdatedAt: completedAt,
    };

    await Promise.all([
      deps.updateJobState({
        jobId: job.id,
        instanceId: job.instanceId,
        status: 'succeeded',
        attempts,
        startedAt: job.startedAt ?? startedAt,
        finishedAt: completedAt,
        progress,
        resultPayload: result?.resultPayload,
        workerId,
        heartbeatAt: completedAt,
      }),
      deps.appendSucceededEvent({
        eventType: 'job.succeeded',
        jobId: job.id,
        instanceId: job.instanceId,
        progress,
        attempts,
        hostDetails: {
          workerId,
        },
      }),
    ]);
  },

  markRetriedOrFailed: async ({
    job,
    attempts,
    startedAt,
    workerId,
    errorPayload,
    finalFailure,
  }: BaseStateInput & {
    readonly errorPayload: StudioJobError;
    readonly finalFailure: boolean;
  }): Promise<void> => {
    const occurredAt = getNow(deps);
    const status = finalFailure ? 'failed' : 'retrying';

    await Promise.all([
      deps.updateJobState({
        jobId: job.id,
        instanceId: job.instanceId,
        status,
        attempts,
        startedAt: job.startedAt ?? startedAt,
        finishedAt: finalFailure ? occurredAt : undefined,
        progress: job.progress,
        errorPayload,
        workerId,
        heartbeatAt: occurredAt,
      }),
      finalFailure
        ? deps.appendFailedEvent({
            jobId: job.id,
            instanceId: job.instanceId,
            progress: job.progress,
            attempts,
            errorPayload,
            hostDetails: {
              workerId,
            },
          })
        : deps.appendRetriedEvent({
            jobId: job.id,
            instanceId: job.instanceId,
            progress: job.progress,
            attempts,
            errorPayload,
            hostDetails: {
              workerId,
            },
          }),
    ]);
  },

  markMissingHandler: async ({
    job,
    attempts,
    startedAt,
    workerId,
    errorPayload,
  }: BaseStateInput & {
    readonly errorPayload: StudioJobError;
  }): Promise<void> => {
    const finishedAt = getNow(deps);

    await Promise.all([
      deps.updateJobState({
        jobId: job.id,
        instanceId: job.instanceId,
        status: 'failed',
        attempts,
        startedAt: job.startedAt ?? startedAt,
        finishedAt,
        progress: job.progress,
        errorPayload,
        workerId,
        heartbeatAt: finishedAt,
      }),
      deps.appendFailedEvent({
        jobId: job.id,
        instanceId: job.instanceId,
        progress: job.progress,
        attempts,
        errorPayload,
        hostDetails: {
          workerId,
        },
      }),
    ]);
  },

  markCancelled: async ({
    job,
    attempts,
    startedAt,
    workerId,
    message,
    cancelRequestedAt,
  }: BaseStateInput & {
    readonly message?: string;
    readonly cancelRequestedAt?: string;
  }): Promise<void> => {
    const finishedAt = getNow(deps);

    await Promise.all([
      deps.updateJobState({
        jobId: job.id,
        instanceId: job.instanceId,
        status: 'cancelled',
        attempts,
        startedAt: job.startedAt ?? startedAt,
        finishedAt,
        progress: job.progress,
        workerId,
        heartbeatAt: finishedAt,
      }),
      deps.appendCancelledEvent?.({
        eventType: 'job.cancelled',
        jobId: job.id,
        instanceId: job.instanceId,
        progress: job.progress,
        attempts,
        message,
        hostDetails: {
          workerId,
          cancellationRequestedAt: cancelRequestedAt ?? job.cancelRequestedAt,
        },
      }),
    ]);
  },
});
