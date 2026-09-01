import type {
  StudioJobError,
  StudioJobEventHostDetails,
  StudioJobRecord,
  StudioJobUpdateInput,
  StudioJobEventCreateInput,
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
  readonly persistTerminalState?: (input: {
    readonly state: StudioJobUpdateInput;
    readonly event: Omit<StudioJobEventCreateInput, 'id' | 'jobId' | 'instanceId'>;
  }) => Promise<unknown>;
};

type BaseStateInput = {
  readonly job: StudioJobRecord;
  readonly attempts: number;
  readonly startedAt: string;
  readonly workerId: string;
  readonly progress?: StudioJobRecord['progress'];
};

const getNow = (deps: JobStateWriterDeps): string =>
  (deps.now ?? (() => new Date().toISOString()))();

const persistTerminal = async (
  deps: JobStateWriterDeps,
  input: {
    readonly state: StudioJobUpdateInput;
    readonly event: Omit<StudioJobEventCreateInput, 'id' | 'jobId' | 'instanceId'>;
    readonly legacyEvent: () => Promise<unknown> | undefined;
  }
): Promise<void> => {
  if (deps.persistTerminalState) {
    await deps.persistTerminalState({ state: input.state, event: input.event });
    return;
  }
  await Promise.all([deps.updateJobState(input.state), input.legacyEvent()]);
};

export const createJobStateWriter = (deps: JobStateWriterDeps) => ({
  markRunning: async ({ job, attempts, startedAt, workerId }: BaseStateInput): Promise<void> => {
    await deps.updateJobState({
      jobId: job.id,
      instanceId: job.instanceId,
      status: 'running',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      progress: job.progress,
      workerId,
      heartbeatAt: startedAt,
    });
    await deps.appendStartedEvent({
      eventType: 'job.started',
      jobId: job.id,
      instanceId: job.instanceId,
      progress: job.progress,
      attempts,
      hostDetails: {
        workerId,
      },
    });
  },

  markSucceeded: async ({
    job,
    attempts,
    startedAt,
    workerId,
    result,
  }: BaseStateInput & {
    readonly result: PluginOperationExecutionResult | void;
  }): Promise<void> => {
    const completedAt = getNow(deps);
    const progress = result?.progress ?? {
      completedSteps: 1,
      totalSteps: 1,
      currentPhase: 'completed',
      lastUpdatedAt: completedAt,
    };

    const state = {
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
    } satisfies StudioJobUpdateInput;
    await persistTerminal(deps, {
      state,
      event: {
        eventType: 'job.succeeded',
        status: 'succeeded',
        progress,
        attempts,
        details: { host: { workerId } },
      },
      legacyEvent: () =>
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
    });
  },

  markRetriedOrFailed: async ({
    job,
    attempts,
    startedAt,
    workerId,
    progress,
    errorPayload,
    finalFailure,
  }: BaseStateInput & {
    readonly errorPayload: StudioJobError;
    readonly finalFailure: boolean;
  }): Promise<void> => {
    const occurredAt = getNow(deps);
    const status = finalFailure ? 'failed' : 'retrying';

    const state = {
      jobId: job.id,
      instanceId: job.instanceId,
      status,
      attempts,
      startedAt: job.startedAt ?? startedAt,
      finishedAt: finalFailure ? occurredAt : undefined,
      progress: progress ?? job.progress,
      errorPayload,
      workerId,
      heartbeatAt: occurredAt,
    } satisfies StudioJobUpdateInput;
    if (!finalFailure) {
      await deps.updateJobState(state);
      await deps.appendRetriedEvent({
        jobId: job.id,
        instanceId: job.instanceId,
        progress: progress ?? job.progress,
        attempts,
        errorPayload,
        hostDetails: { workerId },
      });
      return;
    }
    await persistTerminal(deps, {
      state,
      event: {
        eventType: 'job.failed',
        status: 'failed',
        progress: progress ?? job.progress,
        attempts,
        message: errorPayload.message,
        details: {
          host: {
            ...(errorPayload.details?.host ?? {}),
            workerId,
            errorCode: errorPayload.code,
            errorCategory: errorPayload.category,
          },
          ...(errorPayload.details?.plugin ? { plugin: errorPayload.details.plugin } : {}),
        },
      },
      legacyEvent: () =>
        deps.appendFailedEvent({
          jobId: job.id,
          instanceId: job.instanceId,
          progress: progress ?? job.progress,
          attempts,
          errorPayload,
          hostDetails: { workerId },
        }),
    });
  },

  markMissingHandler: async ({
    job,
    attempts,
    startedAt,
    workerId,
    progress,
    errorPayload,
  }: BaseStateInput & {
    readonly errorPayload: StudioJobError;
  }): Promise<void> => {
    const finishedAt = getNow(deps);

    const state = {
      jobId: job.id,
      instanceId: job.instanceId,
      status: 'failed',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      finishedAt,
      progress: progress ?? job.progress,
      errorPayload,
      workerId,
      heartbeatAt: finishedAt,
    } satisfies StudioJobUpdateInput;
    await persistTerminal(deps, {
      state,
      event: {
        eventType: 'job.failed',
        status: 'failed',
        progress: progress ?? job.progress,
        attempts,
        message: errorPayload.message,
        details: {
          host: {
            ...(errorPayload.details?.host ?? {}),
            workerId,
            errorCode: errorPayload.code,
            errorCategory: errorPayload.category,
          },
        },
      },
      legacyEvent: () =>
        deps.appendFailedEvent({
          jobId: job.id,
          instanceId: job.instanceId,
          progress: progress ?? job.progress,
          attempts,
          errorPayload,
          hostDetails: {
            workerId,
          },
        }),
    });
  },

  markCancelled: async ({
    job,
    attempts,
    startedAt,
    workerId,
    message,
    progress,
    cancelRequestedAt,
  }: BaseStateInput & {
    readonly message?: string;
    readonly cancelRequestedAt?: string;
  }): Promise<void> => {
    const finishedAt = getNow(deps);

    const state = {
      jobId: job.id,
      instanceId: job.instanceId,
      status: 'cancelled',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      finishedAt,
      progress: progress ?? job.progress,
      workerId,
      heartbeatAt: finishedAt,
    } satisfies StudioJobUpdateInput;
    await persistTerminal(deps, {
      state,
      event: {
        eventType: 'job.cancelled',
        status: 'cancelled',
        progress: progress ?? job.progress,
        attempts,
        message,
        details: {
          host: { workerId, cancellationRequestedAt: cancelRequestedAt ?? job.cancelRequestedAt },
        },
      },
      legacyEvent: () =>
        deps.appendCancelledEvent?.({
          eventType: 'job.cancelled',
          jobId: job.id,
          instanceId: job.instanceId,
          progress: progress ?? job.progress,
          attempts,
          message,
          hostDetails: {
            workerId,
            cancellationRequestedAt: cancelRequestedAt ?? job.cancelRequestedAt,
          },
        }),
    });
  },
});
