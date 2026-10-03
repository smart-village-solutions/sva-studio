import { EventEmitter } from 'node:events';
import * as graphileWorker from 'graphile-worker';

import { createSdkLogger } from '@sva/server-runtime';

import { resolveStudioJobWorkerPool } from '../db.js';
import { recordPluginTenantLifecycleLaneSuccess } from '../plugin-tenant-lifecycle/observability.js';
import {
  createStudioJobTaskList,
  getRegisteredStudioJobExecutionRegistry,
} from './runner-registry.js';

export const logger = createSdkLogger({ component: 'studio-jobs-runner', level: 'info' });

const explicitlyStoppedWorkers = new WeakSet<graphileWorker.WorkerPool>();
const terminallyFailedWorkers = new WeakSet<graphileWorker.WorkerPool>();

type StudioJobWorkerStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'failed';
export type StudioJobWorkerLane = 'default' | 'privileged';
export type StudioJobWorkerTerminalFailure = {
  readonly error: unknown;
  readonly lane: StudioJobWorkerLane;
};
export type StudioJobWorkerStartOptions = {
  readonly onTerminalFailure?: (failure: StudioJobWorkerTerminalFailure) => void;
};
export type StudioJobWorkerHealth = {
  readonly ready: boolean;
  readonly reasonCode?: string;
  readonly status: StudioJobWorkerStatus | 'disabled';
};

export const markStudioJobWorkerExplicitStop = (workerPool: graphileWorker.WorkerPool): void => {
  explicitlyStoppedWorkers.add(workerPool);
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
  lane: StudioJobWorkerLane,
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
  events.on('job:success', () => recordPluginTenantLifecycleLaneSuccess(lane));
  events.on('pool:listen:error', (event) => markFailed('connection_failed', event));
  events.on('worker:getJob:error', (event) => markFailed('claim_failed', event));
  events.on('worker:fatalError', (event) => {
    retiring = true;
    markFailed('runtime_failed', event);
    handleFatalError(event.error);
  });
  events.on('resetLocked:failure', (event) => markFailed('maintenance_failed', event));
};

export const createGraphileWorkerRunner = (
  taskIdentifier: string,
  lane: StudioJobWorkerLane,
  reasonPrefix: string,
  updateHealth: (health: StudioJobWorkerHealth) => void,
  handleFatalError: (error: unknown) => void
): graphileWorker.WorkerPool => {
  const pool = resolveStudioJobWorkerPool();
  if (!pool) {
    throw new Error('studio_job_worker_database_unavailable');
  }

  const events = new EventEmitter() as graphileWorker.WorkerEvents;
  observeWorkerHealth(events, lane, reasonPrefix, updateHealth, handleFatalError);
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

export const retireTerminalWorker = (
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

export const observeWorkerFailure = (
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
