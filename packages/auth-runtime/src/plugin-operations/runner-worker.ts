import * as graphileWorker from 'graphile-worker';

import { recordPluginTenantLifecycleLaneHealth } from '../plugin-tenant-lifecycle/observability.js';
import { privilegedStudioJobTaskIdentifier, studioJobTaskIdentifier } from './runner-registry.js';
import {
  createGraphileWorkerRunner,
  logger,
  markStudioJobWorkerExplicitStop,
  observeWorkerFailure,
  retireTerminalWorker,
} from './runner-worker-support.js';
import type {
  StudioJobWorkerHealth,
  StudioJobWorkerStartOptions,
} from './runner-worker-support.js';
export type {
  StudioJobWorkerStartOptions,
  StudioJobWorkerTerminalFailure,
} from './runner-worker-support.js';

export { queuePluginOperationJob, queueStudioJob } from './runner-queue.js';

let runner: graphileWorker.WorkerPool | null = null;
let privilegedRunner: graphileWorker.WorkerPool | null = null;
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

const updateRunnerHealth = (health: StudioJobWorkerHealth): void => {
  runnerHealth = health;
  recordPluginTenantLifecycleLaneHealth('default', health);
};

const updatePrivilegedRunnerHealth = (health: StudioJobWorkerHealth): void => {
  privilegedRunnerHealth = health;
  recordPluginTenantLifecycleLaneHealth('privileged', health);
};

export const ensureStudioJobWorkerStarted = async (
  options: StudioJobWorkerStartOptions = {}
): Promise<void> => {
  if (runner) return;
  updateRunnerHealth({
    ready: false,
    reasonCode: 'studio_job_worker_starting',
    status: 'starting',
  });
  try {
    let startedRunner: graphileWorker.WorkerPool | null = null;
    startedRunner = observeWorkerFailure(
      createGraphileWorkerRunner(
        studioJobTaskIdentifier,
        'default',
        'studio_job_worker',
        (health) => {
          if (runner === null || runner === startedRunner) updateRunnerHealth(health);
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
          updateRunnerHealth({
            ready: false,
            reasonCode: 'studio_job_worker_runtime_failed',
            status: 'failed',
          });
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
    updateRunnerHealth({
      ready: false,
      reasonCode: 'studio_job_worker_start_failed',
      status: 'failed',
    });
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
  updatePrivilegedRunnerHealth({
    ready: false,
    reasonCode: 'privileged_studio_job_worker_starting',
    status: 'starting',
  });
  try {
    let startedRunner: graphileWorker.WorkerPool | null = null;
    startedRunner = observeWorkerFailure(
      createGraphileWorkerRunner(
        privilegedStudioJobTaskIdentifier,
        'privileged',
        'privileged_studio_job_worker',
        (health) => {
          if (privilegedRunner === null || privilegedRunner === startedRunner) {
            updatePrivilegedRunnerHealth(health);
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
          updatePrivilegedRunnerHealth({
            ready: false,
            reasonCode: 'privileged_studio_job_worker_runtime_failed',
            status: 'failed',
          });
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
    updatePrivilegedRunnerHealth({
      ready: false,
      reasonCode: 'privileged_studio_job_worker_start_failed',
      status: 'failed',
    });
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

  markStudioJobWorkerExplicitStop(runner);
  await runner.gracefulShutdown();
  runner = null;
  updateRunnerHealth({
    ready: false,
    reasonCode: 'studio_job_worker_stopped',
    status: 'stopped',
  });
};

export const stopPrivilegedStudioJobWorker = async (): Promise<void> => {
  if (!privilegedRunner) return;
  markStudioJobWorkerExplicitStop(privilegedRunner);
  await privilegedRunner.gracefulShutdown();
  privilegedRunner = null;
  updatePrivilegedRunnerHealth({
    ready: false,
    reasonCode: 'privileged_studio_job_worker_stopped',
    status: 'stopped',
  });
};

export const stopPluginOperationWorker = stopStudioJobWorker;
