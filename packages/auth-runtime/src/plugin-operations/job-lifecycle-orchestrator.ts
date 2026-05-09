import type { StudioJobRecord } from '@sva/core';
import type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionHandlerContext,
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
  readonly resolveHandler: (jobTypeId: string) => PluginOperationExecutionHandler | undefined;
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

const createStateWriter = (repository: Pick<RepositoryPort, 'updateJobState' | 'appendJobEvent'>, now?: () => string) => {
  const eventWriter = createJobEventWriter({
    appendJobEvent: repository.appendJobEvent,
  });

  return createJobStateWriter({
    updateJobState: repository.updateJobState,
    appendStartedEvent: eventWriter.appendStartedEvent,
    appendSucceededEvent: eventWriter.appendSucceededEvent,
    appendRetriedEvent: eventWriter.appendRetriedEvent,
    appendFailedEvent: eventWriter.appendFailedEvent,
    appendCancelledEvent: eventWriter.appendCancelledEvent,
    now,
  });
};

const createHandlerContext = async (
  deps: OrchestratorDeps,
  job: StudioJobRecord,
  attempts: number,
  workerId: string
): Promise<Omit<PluginOperationExecutionHandlerContext, 'job'>> => {
  const progressReporter = createJobProgressReporter({
    job,
    attempts,
    workerId,
    updateJobProgress: async (input) => (await deps.loadRepository(job.instanceId)).updateJobProgress(input),
    appendProgressedEvent: async (input) =>
      createJobEventWriter({
        appendJobEvent: (await deps.loadRepository(job.instanceId)).appendJobEvent,
      }).appendProgressedEvent(input),
    now: deps.now,
  });

  return createJobExecutionContext({
    job,
    logger: deps.logger,
    progressReporter,
    isCancellationRequested: async () => {
      const latestJob = await (await deps.loadRepository(job.instanceId)).getJobById(job.instanceId, job.id);
      return Boolean(latestJob?.cancelRequestedAt);
    },
  });
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
    const handlerContext = await createHandlerContext(deps, job, attempts, workerId);
    const stateWriter = createStateWriter(repository, deps.now);

    await stateWriter.markRunning({
      job,
      attempts,
      startedAt,
      workerId,
    });

    const handler = deps.resolveHandler(job.jobTypeId);
    if (!handler) {
      await stateWriter.markMissingHandler({
        job,
        attempts,
        startedAt,
        workerId,
        errorPayload: createMissingHandlerPayload(job),
      });
      return;
    }

    try {
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
          cancelRequestedAt: error.cancelRequestedAt,
        });
        return;
      }

      const finalFailure = attempts >= maxAttempts;
      await stateWriter.markRetriedOrFailed({
        job,
        attempts,
        startedAt,
        workerId,
        errorPayload: createExecutionErrorPayload(error, finalFailure),
        finalFailure,
      });
      if (!finalFailure) {
        throw error;
      }
    }
  },
});
