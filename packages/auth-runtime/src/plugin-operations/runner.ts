import * as graphileWorker from 'graphile-worker';

import type { StudioJobProgress, StudioJobRecord } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { resolvePool } from '../db.js';
import { withStudioJobRepository } from './repository.js';

const logger = createSdkLogger({ component: 'plugin-operations-runner', level: 'info' });

export const pluginOperationTaskIdentifier = 'plugin_operation_execute';

type PluginOperationRunnerPayload = {
  readonly instanceId: string;
  readonly jobId: string;
};

export type PluginOperationExecutionResult = {
  readonly progress?: StudioJobProgress;
  readonly resultPayload?: Readonly<Record<string, unknown>>;
};

export type PluginOperationExecutionHandler = (
  job: StudioJobRecord
) => Promise<PluginOperationExecutionResult | void>;

type PluginOperationExecutionRegistry = ReadonlyMap<string, PluginOperationExecutionHandler>;

type QueuePluginOperationJobInput = {
  readonly instanceId: string;
  readonly jobId: string;
  readonly queueName: string;
  readonly maxAttempts: number;
};

let runnerPromise: Promise<graphileWorker.Runner> | null = null;
let registeredHandlers = new Map<string, PluginOperationExecutionHandler>();

const parseWorkerConcurrency = (rawValue: string | undefined): number => {
  const fallback = 1;
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 16);
};

const createMissingHandlerPayload = (job: StudioJobRecord) => ({
  code: 'plugin_operation_handler_missing',
  retryable: false,
  jobTypeId: job.jobTypeId,
  pluginId: job.pluginId,
});

const toErrorPayload = (error: unknown, retryable: boolean) => ({
  code: 'plugin_operation_execution_failed',
  retryable,
  message: error instanceof Error ? error.message : String(error),
});

const markJobRunning = async (job: StudioJobRecord, attempts: number, startedAt: string) =>
  withStudioJobRepository(job.instanceId, (repository) =>
    repository.updateJobState({
      jobId: job.id,
      instanceId: job.instanceId,
      status: 'running',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      progress: job.progress,
    })
  );

const markJobCompleted = async (
  job: StudioJobRecord,
  attempts: number,
  startedAt: string,
  result: PluginOperationExecutionResult | void
) =>
  withStudioJobRepository(job.instanceId, (repository) =>
    repository.updateJobState({
      jobId: job.id,
      instanceId: job.instanceId,
      status: 'succeeded',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      finishedAt: new Date().toISOString(),
      progress: result?.progress ?? { completedSteps: 1, totalSteps: 1, currentPhase: 'completed' },
      resultPayload: result?.resultPayload,
    })
  );

const markJobRetriedOrFailed = async (
  job: StudioJobRecord,
  attempts: number,
  startedAt: string,
  error: unknown,
  finalFailure: boolean
) =>
  withStudioJobRepository(job.instanceId, (repository) =>
    repository.updateJobState({
      jobId: job.id,
      instanceId: job.instanceId,
      status: finalFailure ? 'failed' : 'retrying',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      finishedAt: finalFailure ? new Date().toISOString() : undefined,
      progress: job.progress,
      errorPayload: toErrorPayload(error, !finalFailure),
    })
  );

const markJobMissingHandler = async (job: StudioJobRecord, attempts: number, startedAt: string) =>
  withStudioJobRepository(job.instanceId, (repository) =>
    repository.updateJobState({
      jobId: job.id,
      instanceId: job.instanceId,
      status: 'failed',
      attempts,
      startedAt: job.startedAt ?? startedAt,
      finishedAt: new Date().toISOString(),
      progress: job.progress,
      errorPayload: createMissingHandlerPayload(job),
    })
  );

export const registerPluginOperationExecutionHandlers = (
  handlers: Readonly<Record<string, PluginOperationExecutionHandler>>
): void => {
  registeredHandlers = new Map(Object.entries(handlers));
};

export const getRegisteredPluginOperationExecutionHandlers = (): PluginOperationExecutionRegistry =>
  registeredHandlers;

export const createPluginOperationTaskList = (
  getHandlers: () => PluginOperationExecutionRegistry
): graphileWorker.TaskList => ({
  [pluginOperationTaskIdentifier]: async (payload, helpers) => {
    const { instanceId, jobId } = payload as PluginOperationRunnerPayload;
    const job = await withStudioJobRepository(instanceId, (repository) => repository.getJobById(instanceId, jobId));
    if (!job) {
      logger.warn('Plugin-Operations-Jobdatensatz zur Worker-Ausführung nicht gefunden', {
        operation: 'plugin_operation_job_missing',
        job_id: jobId,
        instance_id: instanceId,
      });
      return;
    }

    const attempts = helpers.job.attempts;
    const startedAt = new Date().toISOString();
    await markJobRunning(job, attempts, startedAt);

    const handler = getHandlers().get(job.jobTypeId);
    if (!handler) {
      await markJobMissingHandler(job, attempts, startedAt);
      return;
    }

    try {
      const result = await handler(job);
      await markJobCompleted(job, attempts, startedAt, result);
    } catch (error) {
      const finalFailure = attempts >= helpers.job.max_attempts;
      await markJobRetriedOrFailed(job, attempts, startedAt, error, finalFailure);
      if (!finalFailure) {
        throw error;
      }
    }
  },
});

const createGraphileWorkerRunner = async (): Promise<graphileWorker.Runner> => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('plugin_operation_worker_database_unavailable');
  }

  await graphileWorker.runMigrations({ pgPool: pool });

  return graphileWorker.run({
    pgPool: pool,
    taskList: createPluginOperationTaskList(getRegisteredPluginOperationExecutionHandlers),
    concurrency: parseWorkerConcurrency(process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY),
    noHandleSignals: true,
  });
};

export const ensurePluginOperationWorkerStarted = async (): Promise<void> => {
  runnerPromise ??= createGraphileWorkerRunner().catch((error) => {
    runnerPromise = null;
    logger.error('Plugin-Operations-Worker konnte nicht gestartet werden', {
      operation: 'plugin_operation_worker_start_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

  await runnerPromise;
};

const getRunner = async (): Promise<graphileWorker.Runner> => {
  await ensurePluginOperationWorkerStarted();
  if (!runnerPromise) {
    throw new Error('plugin_operation_worker_not_started');
  }
  return runnerPromise;
};

export const queuePluginOperationJob = async (input: QueuePluginOperationJobInput): Promise<void> => {
  const runner = await getRunner();
  await runner.addJob(
    pluginOperationTaskIdentifier,
    {
      instanceId: input.instanceId,
      jobId: input.jobId,
    } satisfies PluginOperationRunnerPayload,
    {
      queueName: input.queueName,
      maxAttempts: input.maxAttempts,
      jobKey: `plugin-operation:${input.jobId}`,
    }
  );
};

export const stopPluginOperationWorker = async (): Promise<void> => {
  if (!runnerPromise) {
    return;
  }

  const runner = await runnerPromise;
  await runner.stop();
  runnerPromise = null;
};
