import * as graphileWorker from 'graphile-worker';

import type { StudioJobSource } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { resolvePool } from '../db.js';
import { bootstrapStudioAppDbUserIfNeeded } from '../postgres-app-user-bootstrap.js';
import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import { withStudioJobRepository } from './repository.js';
import type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionHandlerContext,
  StudioJobExecutionHandler,
} from './types.js';

const logger = createSdkLogger({ component: 'studio-jobs-runner', level: 'info' });

export const studioJobTaskIdentifier = 'studio_job_execute';
export const pluginOperationTaskIdentifier = studioJobTaskIdentifier;

type StudioJobRunnerPayload = {
  readonly instanceId: string;
  readonly jobId: string;
};

export type StudioJobExecutionRegistration = {
  readonly source: StudioJobSource;
  readonly jobTypeId: string;
  readonly handler: StudioJobExecutionHandler;
  readonly queueName: string;
};

export type PluginOperationExecutionRegistration = {
  readonly handler: PluginOperationExecutionHandler;
  readonly queueName: string;
};

type StudioJobExecutionRegistry = ReadonlyMap<string, StudioJobExecutionRegistration>;
type PluginOperationExecutionRegistry = ReadonlyMap<string, PluginOperationExecutionRegistration>;

type QueueStudioJobInput = {
  readonly instanceId: string;
  readonly jobId: string;
  readonly queueName: string;
  readonly maxAttempts: number;
};

let runnerPromise: Promise<graphileWorker.Runner> | null = null;
let registeredStudioJobHandlers = new Map<string, StudioJobExecutionRegistration>();

const toRegistryKey = (source: StudioJobSource, jobTypeId: string): string => `${source}:${jobTypeId}`;

const normalizePluginRegistration = (
  jobTypeId: string,
  value: PluginOperationExecutionHandler | PluginOperationExecutionRegistration
): StudioJobExecutionRegistration => ({
  source: 'plugin',
  jobTypeId,
  handler: adaptPluginOperationExecutionHandler(
    typeof value === 'function' ? value : value.handler
  ),
  queueName: typeof value === 'function' ? 'plugin-operations' : value.queueName,
});

const adaptPluginOperationExecutionHandler = (
  handler: PluginOperationExecutionHandler
): StudioJobExecutionHandler => {
  return async (context) => {
    if (!context.pluginId) {
      throw new Error('plugin_job_missing_plugin_id');
    }

    return (await handler(context as PluginOperationExecutionHandlerContext)) ?? {};
  };
};

const replaceRegistrationsBySource = (
  nextSource: StudioJobSource,
  nextRegistrations: readonly StudioJobExecutionRegistration[]
): void => {
  const preservedEntries = [...registeredStudioJobHandlers.values()].filter((entry) => entry.source !== nextSource);
  registeredStudioJobHandlers = new Map(
    [...preservedEntries, ...nextRegistrations].map((entry) => [toRegistryKey(entry.source, entry.jobTypeId), entry])
  );
};

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

export const registerStudioJobExecutionHandlers = (handlers: readonly StudioJobExecutionRegistration[]): void => {
  replaceRegistrationsBySource(
    'host',
    handlers.filter((entry) => entry.source === 'host')
  );
};

export const registerPluginOperationExecutionHandlers = (
  handlers: Readonly<Record<string, PluginOperationExecutionHandler | PluginOperationExecutionRegistration>>
): void => {
  replaceRegistrationsBySource(
    'plugin',
    Object.entries(handlers).map(([jobTypeId, value]) => normalizePluginRegistration(jobTypeId, value))
  );
};

export const getRegisteredStudioJobExecutionRegistry = (): StudioJobExecutionRegistry => registeredStudioJobHandlers;

export const getRegisteredPluginOperationExecutionRegistry = (): PluginOperationExecutionRegistry =>
  new Map(
    [...registeredStudioJobHandlers.values()]
      .filter((entry): entry is StudioJobExecutionRegistration & { source: 'plugin' } => entry.source === 'plugin')
      .map((entry) => [
        entry.jobTypeId,
        {
          handler: entry.handler as PluginOperationExecutionHandler,
          queueName: entry.queueName,
        },
      ])
  );

export const createStudioJobTaskList = (
  getHandlers: () => StudioJobExecutionRegistry
): graphileWorker.TaskList => ({
  [studioJobTaskIdentifier]: async (payload, helpers) => {
    const { instanceId, jobId } = payload as StudioJobRunnerPayload;
    await createJobLifecycleOrchestrator({
      logger,
      loadRepository: async (tenantInstanceId) => ({
        getJobById: (repositoryInstanceId, repositoryJobId) =>
          withStudioJobRepository(tenantInstanceId, (repository) =>
            repository.getJobById(repositoryInstanceId, repositoryJobId)
          ),
        updateJobState: (input) =>
          withStudioJobRepository(tenantInstanceId, (repository) => repository.updateJobState(input)),
        updateJobProgress: (input) =>
          withStudioJobRepository(tenantInstanceId, (repository) => repository.updateJobProgress(input)),
        appendJobEvent: (input) =>
          withStudioJobRepository(tenantInstanceId, (repository) => repository.appendJobEvent(input)),
      }),
      resolveHandler: (job) => getHandlers().get(toRegistryKey(job.source, job.jobTypeId))?.handler,
    }).run({
      instanceId,
      jobId,
      attempts: helpers.job.attempts,
      maxAttempts: helpers.job.max_attempts,
    });
  },
});

export const createPluginOperationTaskList = (
  getHandlers: () => PluginOperationExecutionRegistry
): graphileWorker.TaskList =>
  createStudioJobTaskList(
    () =>
      new Map(
        [...getHandlers().entries()].map(([jobTypeId, registration]) => [
          toRegistryKey('plugin', jobTypeId),
          normalizePluginRegistration(jobTypeId, registration),
        ])
      )
  );

const createGraphileWorkerRunner = async (): Promise<graphileWorker.Runner> => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('studio_job_worker_database_unavailable');
  }

  const startRunner = async (): Promise<graphileWorker.Runner> => {
    await graphileWorker.runMigrations({ pgPool: pool });

    return graphileWorker.run({
      pgPool: pool,
      taskList: createStudioJobTaskList(getRegisteredStudioJobExecutionRegistry),
      concurrency: parseWorkerConcurrency(process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY),
      noHandleSignals: true,
    });
  };

  try {
    return await startRunner();
  } catch (error) {
    const bootstrapped = await bootstrapStudioAppDbUserIfNeeded(error);
    if (!bootstrapped) {
      throw error;
    }
    return startRunner();
  }
};

export const ensureStudioJobWorkerStarted = async (): Promise<void> => {
  runnerPromise ??= createGraphileWorkerRunner().catch((error) => {
    runnerPromise = null;
    logger.error('Studio-Job-Worker konnte nicht gestartet werden', {
      operation: 'studio_job_worker_start_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

  await runnerPromise;
};

export const ensurePluginOperationWorkerStarted = ensureStudioJobWorkerStarted;

const getRunner = async (): Promise<graphileWorker.Runner> => {
  await ensureStudioJobWorkerStarted();
  if (!runnerPromise) {
    throw new Error('studio_job_worker_not_started');
  }
  return runnerPromise;
};

export const queueStudioJob = async (input: QueueStudioJobInput): Promise<void> => {
  const runner = await getRunner();
  await runner.addJob(
    studioJobTaskIdentifier,
    {
      instanceId: input.instanceId,
      jobId: input.jobId,
    } satisfies StudioJobRunnerPayload,
    {
      queueName: input.queueName,
      maxAttempts: input.maxAttempts,
      jobKey: `studio-job:${input.jobId}`,
    }
  );
};

export const queuePluginOperationJob = queueStudioJob;

export const stopStudioJobWorker = async (): Promise<void> => {
  if (!runnerPromise) {
    return;
  }

  const runner = await runnerPromise;
  await runner.stop();
  runnerPromise = null;
};

export const stopPluginOperationWorker = stopStudioJobWorker;

export type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionHandlerContext,
  PluginOperationExecutionResult,
  PluginOperationProgressReporter,
  StudioJobExecutionHandler,
  StudioJobExecutionHandlerContext,
  StudioJobExecutionResult,
} from './types.js';
