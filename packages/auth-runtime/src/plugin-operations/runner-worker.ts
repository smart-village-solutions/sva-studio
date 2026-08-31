import { EventEmitter } from 'node:events';
import * as graphileWorker from 'graphile-worker';

import { createSdkLogger } from '@sva/server-runtime';

import { resolveStudioJobWorkerPool } from '../db.js';
import {
  createStudioJobTaskList,
  getRegisteredStudioJobExecutionRegistry,
  privilegedStudioJobTaskIdentifier,
  studioJobTaskIdentifier,
} from './runner-registry.js';

export { queuePluginOperationJob, queueStudioJob } from './runner-queue.js';

const logger = createSdkLogger({ component: 'studio-jobs-runner', level: 'info' });

let runner: graphileWorker.WorkerPool | null = null;
let privilegedRunner: graphileWorker.WorkerPool | null = null;
const explicitlyStoppedWorkers = new WeakSet<graphileWorker.WorkerPool>();
const terminallyFailedWorkers = new WeakSet<graphileWorker.WorkerPool>();
type StudioJobWorkerStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'failed';
type StudioJobWorkerLane = 'default' | 'privileged';
export type StudioJobWorkerTerminalFailure = {
  readonly error: unknown;
  readonly lane: StudioJobWorkerLane;
};
export type StudioJobWorkerStartOptions = {
  readonly onTerminalFailure?: (failure: StudioJobWorkerTerminalFailure) => void;
};
type StudioJobWorkerHealth = {
  readonly ready: boolean;
  readonly reasonCode?: string;
  readonly status: StudioJobWorkerStatus | 'disabled';
};

let runnerHealth: StudioJobWorkerHealth = {
  ready: false,
  reasonCode: 'studio_job_worker_not_started',
  status: 'idle',
};
let privilegedRunnerHealth: StudioJobWorkerHealth = {
  ready: false,
  reasonCode: 'privileged_studio_job_worker_not_started',
  status: 'idle',
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

const observeWorkerHealth = (
  events: graphileWorker.WorkerEvents,
  reasonPrefix: string,
  updateHealth: (health: StudioJobWorkerHealth) => void,
  handleFatalError: (error: unknown) => void
): void => {
  let retiring = false;
  const markReady = () => {
    if (!retiring) updateHealth({ ready: true, status: 'running' });
  };
  const markFailed = (reason: string, event: { error?: unknown }) => {
    updateHealth({ ready: false, reasonCode: `${reasonPrefix}_${reason}`, status: 'failed' });
    logger.error('Studio-Job-Worker ist nicht verarbeitungsbereit', {
      operation: `${reasonPrefix}_${reason}`,
      error: event.error instanceof Error ? event.error.message : String(event.error ?? reason),
    });
  };

  events.on('worker:getJob:empty', markReady);
  events.on('job:start', markReady);
  events.on('pool:listen:error', (event) => markFailed('connection_failed', event));
  events.on('worker:getJob:error', (event) => markFailed('claim_failed', event));
  events.on('worker:fatalError', (event) => {
    retiring = true;
    markFailed('runtime_failed', event);
    handleFatalError(event.error);
  });
  events.on('resetLocked:failure', (event) => markFailed('maintenance_failed', event));
};

const createGraphileWorkerRunner = (
  taskIdentifier: string,
  reasonPrefix: string,
  updateHealth: (health: StudioJobWorkerHealth) => void,
  handleFatalError: (error: unknown) => void
): graphileWorker.WorkerPool => {
  const pool = resolveStudioJobWorkerPool();
  if (!pool) {
    throw new Error('studio_job_worker_database_unavailable');
  }

  const events = new EventEmitter() as graphileWorker.WorkerEvents;
  observeWorkerHealth(events, reasonPrefix, updateHealth, handleFatalError);
  return graphileWorker.runTaskList(
    {
      concurrency: parseWorkerConcurrency(process.env.SVA_PLUGIN_OPERATION_WORKER_CONCURRENCY),
      events,
      noHandleSignals: true,
    },
    createStudioJobTaskList(getRegisteredStudioJobExecutionRegistry, taskIdentifier),
    pool
  );
};

const retireTerminalWorker = (
  workerPool: graphileWorker.WorkerPool | null,
  operation: string,
  lane: StudioJobWorkerLane,
  error: unknown,
  onTerminalFailure: StudioJobWorkerStartOptions['onTerminalFailure'],
  clearWorker: (workerPool: graphileWorker.WorkerPool) => void
): void => {
  if (
    !workerPool ||
    explicitlyStoppedWorkers.has(workerPool) ||
    terminallyFailedWorkers.has(workerPool)
  ) {
    return;
  }
  terminallyFailedWorkers.add(workerPool);
  void workerPool
    .gracefulShutdown()
    .catch((error: unknown) => {
      logger.error('Fatal beendeter Studio-Job-Worker konnte nicht sauber gestoppt werden', {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      clearWorker(workerPool);
      onTerminalFailure?.({ error, lane });
    });
};

const observeWorkerFailure = (
  workerPool: graphileWorker.WorkerPool,
  operation: string,
  handleTerminalFailure: (error: unknown) => void
): graphileWorker.WorkerPool => {
  void workerPool.promise.catch((error: unknown) => {
    if (explicitlyStoppedWorkers.has(workerPool) || terminallyFailedWorkers.has(workerPool)) {
      return;
    }
    logger.error('Studio-Job-Worker wurde unerwartet beendet', {
      operation,
      error: error instanceof Error ? error.message : String(error),
    });
    handleTerminalFailure(error);
  });
  return workerPool;
};

export const ensureStudioJobWorkerStarted = async (
  options: StudioJobWorkerStartOptions = {}
): Promise<void> => {
  if (runner) return;
  runnerHealth = {
    ready: false,
    reasonCode: 'studio_job_worker_starting',
    status: 'starting',
  };
  try {
    let startedRunner: graphileWorker.WorkerPool | null = null;
    startedRunner = observeWorkerFailure(
      createGraphileWorkerRunner(
        studioJobTaskIdentifier,
        'studio_job_worker',
        (health) => {
          if (runner === null || runner === startedRunner) runnerHealth = health;
        },
        (error) =>
          retireTerminalWorker(
            startedRunner,
            'studio_job_worker_fatal_shutdown_failed',
            'default',
            error,
            options.onTerminalFailure,
            (failedRunner) => {
              if (runner === failedRunner) runner = null;
            }
          )
      ),
      'studio_job_worker_runtime_failed',
      (error) => {
        if (runner === startedRunner) {
          runnerHealth = {
            ready: false,
            reasonCode: 'studio_job_worker_runtime_failed',
            status: 'failed',
          };
        }
        retireTerminalWorker(
          startedRunner,
          'studio_job_worker_fatal_shutdown_failed',
          'default',
          error,
          options.onTerminalFailure,
          (failedRunner) => {
            if (runner === failedRunner) runner = null;
          }
        );
      }
    );
    runner = startedRunner;
  } catch (error) {
    runnerHealth = {
      ready: false,
      reasonCode: 'studio_job_worker_start_failed',
      status: 'failed',
    };
    logger.error('Studio-Job-Worker konnte nicht gestartet werden', {
      operation: 'studio_job_worker_start_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const ensurePrivilegedStudioJobWorkerStarted = async (
  options: StudioJobWorkerStartOptions = {}
): Promise<void> => {
  if (privilegedRunner) return;
  privilegedRunnerHealth = {
    ready: false,
    reasonCode: 'privileged_studio_job_worker_starting',
    status: 'starting',
  };
  try {
    let startedRunner: graphileWorker.WorkerPool | null = null;
    startedRunner = observeWorkerFailure(
      createGraphileWorkerRunner(
        privilegedStudioJobTaskIdentifier,
        'privileged_studio_job_worker',
        (health) => {
          if (privilegedRunner === null || privilegedRunner === startedRunner) {
            privilegedRunnerHealth = health;
          }
        },
        (error) =>
          retireTerminalWorker(
            startedRunner,
            'privileged_studio_job_worker_fatal_shutdown_failed',
            'privileged',
            error,
            options.onTerminalFailure,
            (failedRunner) => {
              if (privilegedRunner === failedRunner) privilegedRunner = null;
            }
          )
      ),
      'privileged_studio_job_worker_runtime_failed',
      (error) => {
        if (privilegedRunner === startedRunner) {
          privilegedRunnerHealth = {
            ready: false,
            reasonCode: 'privileged_studio_job_worker_runtime_failed',
            status: 'failed',
          };
        }
        retireTerminalWorker(
          startedRunner,
          'privileged_studio_job_worker_fatal_shutdown_failed',
          'privileged',
          error,
          options.onTerminalFailure,
          (failedRunner) => {
            if (privilegedRunner === failedRunner) privilegedRunner = null;
          }
        );
      }
    );
    privilegedRunner = startedRunner;
  } catch (error) {
    privilegedRunnerHealth = {
      ready: false,
      reasonCode: 'privileged_studio_job_worker_start_failed',
      status: 'failed',
    };
    logger.error('Privilegierter Studio-Job-Worker konnte nicht gestartet werden', {
      operation: 'privileged_studio_job_worker_start_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const ensurePluginOperationWorkerStarted = ensureStudioJobWorkerStarted;

export const getStudioJobWorkerHealth = (): StudioJobWorkerHealth => {
  if (process.env.SVA_PLUGIN_OPERATION_WORKER_ENABLED === 'false') {
    return { ready: true, status: 'disabled' };
  }

  return process.env.SVA_PLUGIN_OPERATION_WORKER_LANE === 'privileged'
    ? privilegedRunnerHealth
    : runnerHealth;
};

export const stopStudioJobWorker = async (): Promise<void> => {
  if (!runner) {
    return;
  }

  explicitlyStoppedWorkers.add(runner);
  await runner.gracefulShutdown();
  runner = null;
  runnerHealth = {
    ready: false,
    reasonCode: 'studio_job_worker_stopped',
    status: 'stopped',
  };
};

export const stopPrivilegedStudioJobWorker = async (): Promise<void> => {
  if (!privilegedRunner) return;
  explicitlyStoppedWorkers.add(privilegedRunner);
  await privilegedRunner.gracefulShutdown();
  privilegedRunner = null;
  privilegedRunnerHealth = {
    ready: false,
    reasonCode: 'privileged_studio_job_worker_stopped',
    status: 'stopped',
  };
};

export const stopPluginOperationWorker = stopStudioJobWorker;
