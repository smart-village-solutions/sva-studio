import type { StudioJobRecord } from '@sva/core';
import type {
  StudioJobExecutionHandler,
  StudioJobExecutionHandlerContext,
} from './types.js';

import { isPluginOperationCancellationError } from './job-cancellation.js';
import { createExecutionErrorPayload, createMissingHandlerPayload } from './job-error-mapper.js';
import { createJobEventWriter } from './job-event-writer.js';
import { createJobExecutionContext } from './job-execution-context.js';
import { createJobProgressReporter } from './job-progress-reporter.js';
import { createJobStateWriter } from './job-state-writer.js';
import type { PluginOperationLogger } from './types.js';

type RepositoryPort = {
  readonly getJobById: (instanceId: string, jobId: string) => Promise<StudioJobRecord | null>;
  readonly updateJobState: (input: Parameters<typeof createJobStateWriter>[0]['updateJobState'] extends (
    input: infer TInput
  ) => Promise<unknown>
    ? TInput
    : never) => Promise<unknown>;
  readonly updateJobProgress: (input: Parameters<typeof createJobProgressReporter>[0]['updateJobProgress'] extends (
    input: infer TInput
  ) => Promise<unknown>
    ? TInput
    : never) => Promise<unknown>;
  readonly appendJobEvent: (input: Parameters<typeof createJobEventWriter>[0]['appendJobEvent'] extends (
    input: infer TInput
  ) => Promise<unknown>
    ? TInput
    : never) => Promise<unknown>;
};

type OrchestratorDeps = {
  readonly logger: PluginOperationLogger;
  readonly loadRepository: (instanceId: string) => Promise<RepositoryPort>;
  readonly resolveHandler: (job: Pick<StudioJobRecord, 'source' | 'jobTypeId'>) => StudioJobExecutionHandler | undefined;
  readonly createWorkerId?: (job: { readonly instanceId: string; readonly id: string }) => string;
  readonly now?: () => string;
};

type RunInput = {
  readonly instanceId: string;
  readonly jobId: string;
  readonly attempts: number;
  readonly maxAttempts: number;
};

const defaultCreateWorkerId = (job: { readonly instanceId: string; readonly id: string }): string =>
  `graphile-worker:${job.instanceId}:${job.id}`;

const createHandlerContext = async (
  deps: Pick<OrchestratorDeps, 'logger' | 'now'>,
  repository: RepositoryPort,
  eventWriter: ReturnType<typeof createJobEventWriter>,
  job: StudioJobRecord,
  attempts: number,
  workerId: string
): Promise<{
  readonly handlerContext: Omit<StudioJobExecutionHandlerContext, 'job'>;
  readonly dispose: () => void;
  readonly getLatestProgress: () => StudioJobRecord['progress'];
}> => {
  let latestProgress = job.progress;
  const progressReporter = createJobProgressReporter({
    job,
    attempts,
    workerId,
    updateJobProgress: repository.updateJobProgress,
    appendProgressedEvent: eventWriter.appendProgressedEvent,
    onProgressPersisted: (progress) => {
      latestProgress = progress;
    },
    now: deps.now,
  });

  const managedContext = createJobExecutionContext({
    job,
    logger: deps.logger,
    progressReporter,
    isCancellationRequested: async () => {
      const latestJob = await repository.getJobById(job.instanceId, job.id);
      return Boolean(latestJob?.cancelRequestedAt);
    },
  });

  return {
    handlerContext: managedContext.context,
    dispose: managedContext.dispose,
    getLatestProgress: () => latestProgress,
  };
};

export const createJobLifecycleOrchestrator = (deps: OrchestratorDeps) => ({
  run: async ({ instanceId, jobId, attempts, maxAttempts }: RunInput): Promise<void> => {
    const repository = await deps.loadRepository(instanceId);
    const job = await repository.getJobById(instanceId, jobId);
    if (!job) {
      deps.logger.warn('Plugin-Operations-Jobdatensatz zur Worker-Ausführung nicht gefunden', {
        operation: 'plugin_operation_job_missing',
        job_id: jobId,
        instance_id: instanceId,
      });
      return;
    }

    const startedAt = (deps.now ?? (() => new Date().toISOString()))();
    const workerId = (deps.createWorkerId ?? defaultCreateWorkerId)(job);
    const eventWriter = createJobEventWriter({
      appendJobEvent: repository.appendJobEvent,
    });
    const { handlerContext, dispose, getLatestProgress } = await createHandlerContext(
      deps,
      repository,
      eventWriter,
      job,
      attempts,
      workerId
    );
    const stateWriter = createJobStateWriter({
      updateJobState: repository.updateJobState,
      appendStartedEvent: eventWriter.appendStartedEvent,
      appendSucceededEvent: eventWriter.appendSucceededEvent,
      appendRetriedEvent: eventWriter.appendRetriedEvent,
      appendFailedEvent: eventWriter.appendFailedEvent,
      appendCancelledEvent: eventWriter.appendCancelledEvent,
      now: deps.now,
    });

    try {
      await stateWriter.markRunning({
        job,
        attempts,
        startedAt,
        workerId,
      });

      const handler = deps.resolveHandler(job);
      if (!handler) {
        await stateWriter.markMissingHandler({
          job,
          attempts,
          startedAt,
          workerId,
          progress: getLatestProgress(),
          errorPayload: createMissingHandlerPayload(job),
        });
        return;
      }

      const result = await handler({
        job,
        ...handlerContext,
      });
      await stateWriter.markSucceeded({
        job,
        attempts,
        startedAt,
        workerId,
        result,
      });
    } catch (error) {
      if (isPluginOperationCancellationError(error)) {
        await stateWriter.markCancelled({
          job,
          attempts,
          startedAt,
          workerId,
          message: error.message,
          progress: getLatestProgress(),
          cancelRequestedAt: error.cancelRequestedAt,
        });
        return;
      }

      const errorPayload = createExecutionErrorPayload(job, error, attempts >= maxAttempts);
      const finalFailure = errorPayload.category === 'permanent';
      await stateWriter.markRetriedOrFailed({
        job,
        attempts,
        startedAt,
        workerId,
        progress: getLatestProgress(),
        errorPayload,
        finalFailure,
      });
      if (!finalFailure) {
        throw error;
      }
    } finally {
      dispose();
    }
  },
});
