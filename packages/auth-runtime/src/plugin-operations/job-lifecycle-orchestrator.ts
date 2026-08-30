import type { StudioJobError, StudioJobRecord } from '@sva/core';
import type { StudioJobExecutionHandler, StudioJobExecutionHandlerContext } from './types.js';

import { isPluginOperationCancellationError } from './job-cancellation.js';
import { createExecutionErrorPayload, createMissingHandlerPayload } from './job-error-mapper.js';
import { createJobEventWriter } from './job-event-writer.js';
import { createJobExecutionContext } from './job-execution-context.js';
import { createJobProgressReporter } from './job-progress-reporter.js';
import { createJobStateWriter } from './job-state-writer.js';
import type { PluginOperationLogger } from './types.js';

type RepositoryPort = {
  readonly getJobById: (instanceId: string, jobId: string) => Promise<StudioJobRecord | null>;
  readonly updateJobState: (
    input: Parameters<typeof createJobStateWriter>[0]['updateJobState'] extends (
      input: infer TInput
    ) => Promise<unknown>
      ? TInput
      : never
  ) => Promise<unknown>;
  readonly updateJobProgress: (
    input: Parameters<typeof createJobProgressReporter>[0]['updateJobProgress'] extends (
      input: infer TInput
    ) => Promise<unknown>
      ? TInput
      : never
  ) => Promise<unknown>;
  readonly appendJobEvent: (
    input: Parameters<typeof createJobEventWriter>[0]['appendJobEvent'] extends (
      input: infer TInput
    ) => Promise<unknown>
      ? TInput
      : never
  ) => Promise<unknown>;
};

type OrchestratorDeps = {
  readonly logger: PluginOperationLogger;
  readonly loadRepository: (instanceId: string) => Promise<RepositoryPort>;
  readonly resolveHandler: (
    job: Pick<StudioJobRecord, 'source' | 'jobTypeId'>
  ) => StudioJobExecutionHandler | undefined;
  readonly createWorkerId?: (job: { readonly instanceId: string; readonly id: string }) => string;
  readonly now?: () => string;
  readonly onExecutionSucceeded?: (input: {
    readonly job: StudioJobRecord;
    readonly result: Awaited<ReturnType<StudioJobExecutionHandler>>;
  }) => Promise<void>;
  readonly onExecutionTerminal?: (input: {
    readonly job: StudioJobRecord;
    readonly error: StudioJobError;
    readonly reason: 'failed' | 'missing_handler' | 'cancelled';
  }) => Promise<void>;
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

const createOrchestratorStateWriter = (
  deps: Pick<OrchestratorDeps, 'now'>,
  repository: RepositoryPort,
  eventWriter: ReturnType<typeof createJobEventWriter>
) =>
  createJobStateWriter({
    updateJobState: repository.updateJobState,
    appendStartedEvent: eventWriter.appendStartedEvent,
    appendSucceededEvent: eventWriter.appendSucceededEvent,
    appendRetriedEvent: eventWriter.appendRetriedEvent,
    appendFailedEvent: eventWriter.appendFailedEvent,
    appendCancelledEvent: eventWriter.appendCancelledEvent,
    now: deps.now,
  });

const persistExecutionFailure = async (input: {
  readonly deps: Pick<OrchestratorDeps, 'logger'>;
  readonly stateWriter: ReturnType<typeof createOrchestratorStateWriter>;
  readonly job: StudioJobRecord;
  readonly error: unknown;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly startedAt: string;
  readonly workerId: string;
  readonly progress: StudioJobRecord['progress'];
}): Promise<{ readonly finalFailure: boolean; readonly errorPayload: StudioJobError }> => {
  const errorPayload = createExecutionErrorPayload(
    input.job,
    input.error,
    input.attempts >= input.maxAttempts
  );
  const finalFailure = errorPayload.category === 'permanent';
  try {
    await input.stateWriter.markRetriedOrFailed({
      job: input.job,
      attempts: input.attempts,
      startedAt: input.startedAt,
      workerId: input.workerId,
      progress: input.progress,
      errorPayload,
      finalFailure,
    });
  } catch (persistenceError) {
    input.deps.logger.error('plugin_operation_failure_state_persist_failed', {
      operation: 'plugin_operation_failure_state_persist',
      error_code: 'failure_state_persist_failed',
      error_type:
        persistenceError instanceof Error ? persistenceError.name : typeof persistenceError,
      result: 'secondary_failure',
      final_failure: finalFailure,
      context: {
        job_id: input.job.id,
        execution_id: input.job.id,
        instance_id: input.job.instanceId,
      },
    });
    throw persistenceError;
  }
  return { finalFailure, errorPayload };
};

const runPersistedJob = async (
  deps: OrchestratorDeps,
  repository: RepositoryPort,
  job: StudioJobRecord,
  input: Pick<RunInput, 'attempts' | 'maxAttempts'>
): Promise<void> => {
  const { attempts, maxAttempts } = input;
  const startedAt = (deps.now ?? (() => new Date().toISOString()))();
  const workerId = (deps.createWorkerId ?? defaultCreateWorkerId)(job);
  const eventWriter = createJobEventWriter({ appendJobEvent: repository.appendJobEvent });
  const { handlerContext, dispose, getLatestProgress } = await createHandlerContext(
    deps,
    repository,
    eventWriter,
    job,
    attempts,
    workerId
  );
  const stateWriter = createOrchestratorStateWriter(deps, repository, eventWriter);
  try {
    await stateWriter.markRunning({ job, attempts, startedAt, workerId });
    const handler = deps.resolveHandler(job);
    if (!handler) {
      const errorPayload = createMissingHandlerPayload(job);
      await stateWriter.markMissingHandler({
        job,
        attempts,
        startedAt,
        workerId,
        progress: getLatestProgress(),
        errorPayload,
      });
      await deps.onExecutionTerminal?.({ job, error: errorPayload, reason: 'missing_handler' });
      return;
    }
    const result = await handler({ job, ...handlerContext });
    await deps.onExecutionSucceeded?.({ job, result });
    await stateWriter.markSucceeded({ job, attempts, startedAt, workerId, result });
  } catch (error) {
    if (isPluginOperationCancellationError(error)) {
      const errorPayload: StudioJobError = {
        code: 'plugin_operation_cancelled',
        category: 'permanent',
        message: error.message,
      };
      await stateWriter.markCancelled({
        job,
        attempts,
        startedAt,
        workerId,
        message: error.message,
        progress: getLatestProgress(),
        cancelRequestedAt: error.cancelRequestedAt,
      });
      await deps.onExecutionTerminal?.({ job, error: errorPayload, reason: 'cancelled' });
      return;
    }
    const failure = await persistExecutionFailure({
      deps,
      stateWriter,
      job,
      error,
      attempts,
      maxAttempts,
      startedAt,
      workerId,
      progress: getLatestProgress(),
    });
    if (!failure.finalFailure) throw error;
    await deps.onExecutionTerminal?.({ job, error: failure.errorPayload, reason: 'failed' });
  } finally {
    dispose();
  }
};

const runJobLifecycle = async (deps: OrchestratorDeps, input: RunInput): Promise<void> => {
  const { instanceId, jobId } = input;
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
  await runPersistedJob(deps, repository, job, input);
};

export const createJobLifecycleOrchestrator = (deps: OrchestratorDeps) => ({
  run: (input: RunInput): Promise<void> => runJobLifecycle(deps, input),
});
