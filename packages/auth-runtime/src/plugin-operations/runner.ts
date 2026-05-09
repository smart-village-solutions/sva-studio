import * as graphileWorker from 'graphile-worker';

import { createSdkLogger } from '@sva/server-runtime';

import { resolvePool } from '../db.js';
import { createJobLifecycleOrchestrator } from './job-lifecycle-orchestrator.js';
import { withStudioJobRepository } from './repository.js';
import type { PluginOperationExecutionHandler } from './types.js';

const logger = createSdkLogger({ component: 'plugin-operations-runner', level: 'info' });

export const pluginOperationTaskIdentifier = 'plugin_operation_execute';

type PluginOperationRunnerPayload = {
  readonly instanceId: string;
  readonly jobId: string;
};

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
      resolveHandler: (jobTypeId) => getHandlers().get(jobTypeId),
    }).run({
      instanceId,
      jobId,
      attempts: helpers.job.attempts,
      maxAttempts: helpers.job.max_attempts,
    });
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

export type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionHandlerContext,
  PluginOperationExecutionResult,
  PluginOperationProgressReporter,
} from './types.js';
