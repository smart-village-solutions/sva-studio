import * as graphileWorker from 'graphile-worker';

import { createSdkLogger } from '@sva/server-runtime';

import { resolvePool } from '../db.js';
import { bootstrapStudioAppDbUserIfNeeded } from '../postgres-app-user-bootstrap.js';
import type { QueueStudioJobInput } from './runner-internal.js';
import {
  createStudioJobTaskList,
  getRegisteredStudioJobExecutionRegistry,
  studioJobTaskIdentifier,
} from './runner-registry.js';

const logger = createSdkLogger({ component: 'studio-jobs-runner', level: 'info' });

let runnerPromise: Promise<graphileWorker.Runner> | null = null;

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
    },
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
