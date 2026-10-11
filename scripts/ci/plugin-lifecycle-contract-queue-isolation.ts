import { Pool, runTaskList } from './plugin-lifecycle-contract-database.js';
import {
  createWasteManagementPluginJobTypes,
  wasteManagementOperationsContract,
} from '../../packages/waste-management-contracts/src/index.js';
import {
  assert,
  database,
  instanceId,
  scalar,
  waitFor,
  workerPassword,
} from './plugin-lifecycle-contract-base.js';
import type { ContractRunner } from './plugin-lifecycle-contract-base.js';
import { cleanLifecycle } from './plugin-lifecycle-contract-fixture.js';
import { configureRuntime, getHandlerAttempts } from './plugin-lifecycle-contract-runtime.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import { reportCase } from './plugin-lifecycle-contract-worker.js';

export const wasteIdentity = {
  pluginId: wasteManagementOperationsContract.pluginId,
  jobTypeId: wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase,
};

export const startWasteLifecycle = (runtime: MatrixContext['runtime']) =>
  runtime.start({
    instanceId,
    pluginId: wasteIdentity.pluginId,
    operation: 'provision',
    scheduledAt: new Date().toISOString(),
  });

const wasteProvisioning = createWasteManagementPluginJobTypes().find(
  (definition) =>
    definition.jobTypeId === wasteManagementOperationsContract.jobTypeIds.provisionTenantDatabase
);
assert(wasteProvisioning?.executionLane === 'privileged', 'top01_waste_lane_contract');
assert(wasteProvisioning.queue === 'waste-provisioning', 'top01_waste_queue_contract');

const createPrivilegedWorkerPool = (port: string) =>
  new Pool({
    connectionString: `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`,
    max: 2,
    idleTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    idle_in_transaction_session_timeout: 10_000,
  });

const runBlockedQueue = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime, port } = context;
  await reportCase(
    'TOP-01-waste-provisioning-attempts-within-150-seconds-while-plugin-queue-blocked',
    async () => {
      await cleanLifecycle(adminPool);
      configureRuntime(
        runtime,
        'contract-1',
        'ready',
        wasteProvisioning.executionLane,
        wasteProvisioning.queue,
        wasteIdentity
      );

      let defaultJobStarted = false;
      let releaseDefaultJob = (): void => undefined;
      const defaultJobRelease = new Promise<void>((resolve) => {
        releaseDefaultJob = resolve;
      });
      await adminPool.query(
        `SELECT graphile_worker.sva_enqueue_job(
           'studio_job_execute', '{}'::json, $1, 1, 'studio-job:top01-default-blocker', now()
         )`,
        [wasteManagementOperationsContract.queueName]
      );
      const defaultRunner = runTaskList(
        { concurrency: 1, noHandleSignals: true },
        {
          studio_job_execute: async () => {
            defaultJobStarted = true;
            await defaultJobRelease;
          },
        },
        workerPool
      );
      const privilegedWorkerPool = createPrivilegedWorkerPool(port);
      let privilegedRunner: ContractRunner | undefined;
      try {
        await waitFor('top01-default-queue-blocker-started', async () => defaultJobStarted);
        const enqueuedAt = Date.now();
        const started = await startWasteLifecycle(runtime);
        assert(
          (await scalar(
            adminPool,
            'SELECT (plugin_id = $2 AND job_type_id = $3)::text AS value FROM iam.studio_jobs WHERE id = $1',
            [started.job.id, wasteIdentity.pluginId, wasteIdentity.jobTypeId]
          )) === 'true',
          'top01_waste_job_identity_mismatch'
        );
        privilegedRunner = runTaskList(
          { concurrency: 1, noHandleSignals: true },
          runtime.createTaskList(runtime.registry, 'studio_job_execute_privileged'),
          privilegedWorkerPool
        );
        await waitFor(
          'top01-waste-provisioning-attempt-under-blocked-plugin-queue',
          async () =>
            (await scalar(
              adminPool,
              "SELECT (count(*) = 1)::text AS value FROM iam.studio_job_events WHERE job_id = $1 AND event_type = 'job.started'",
              [started.job.id]
            )) === 'true'
        );
        assert(Date.now() - enqueuedAt < 150_000, 'top01_waste_attempt_exceeded_150_seconds');
        assert(getHandlerAttempts() === 1, 'top01_waste_handler_not_attempted_once');
        assert(
          defaultJobStarted,
          'top01_privileged_job_completed_without_default_queue_contention'
        );
        assert(
          (await scalar(
            adminPool,
            "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
            [started.job.id]
          )) === 'true',
          'top01_waste_job_not_completed_while_plugin_queue_blocked'
        );
      } finally {
        releaseDefaultJob();
        await Promise.all([
          privilegedRunner?.gracefulShutdown() ?? Promise.resolve(),
          defaultRunner.gracefulShutdown(),
        ]);
        await privilegedWorkerPool.end();
      }
    }
  );
};

const runRetryBacklog = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime, port } = context;
  await reportCase(
    'TOP-01-waste-provisioning-attempts-within-150-seconds-under-plugin-retries',
    async () => {
      await cleanLifecycle(adminPool);
      configureRuntime(
        runtime,
        'contract-1',
        'retry-once',
        wasteProvisioning.executionLane,
        wasteProvisioning.queue,
        wasteIdentity
      );
      const failingKey = 'studio-job:top01-default-retry-backlog';
      await adminPool.query(
        `SELECT graphile_worker.sva_enqueue_job(
           'studio_job_execute', '{}'::json, $1, 5, $2, now()
         )`,
        [wasteManagementOperationsContract.queueName, failingKey]
      );
      const defaultRunner = runTaskList(
        { concurrency: 1, noHandleSignals: true },
        {
          studio_job_execute: async () => {
            throw new Error('top01_default_plugin_retry');
          },
        },
        workerPool
      );
      const privilegedWorkerPool = createPrivilegedWorkerPool(port);
      let privilegedRunner: ContractRunner | undefined;
      try {
        await waitFor(
          'top01-default-plugin-retried',
          async () =>
            Number(
              await scalar(
                adminPool,
                'SELECT attempts::text AS value FROM graphile_worker.jobs WHERE key = $1',
                [failingKey]
              )
            ) >= 2
        );
        const enqueuedAt = Date.now();
        const started = await startWasteLifecycle(runtime);
        privilegedRunner = runTaskList(
          { concurrency: 1, noHandleSignals: true },
          runtime.createTaskList(runtime.registry, 'studio_job_execute_privileged'),
          privilegedWorkerPool
        );
        await waitFor(
          'top01-waste-provisioning-attempt-under-plugin-retries',
          async () =>
            (await scalar(
              adminPool,
              "SELECT (count(*) = 1)::text AS value FROM iam.studio_job_events WHERE job_id = $1 AND event_type = 'job.started'",
              [started.job.id]
            )) === 'true'
        );
        assert(Date.now() - enqueuedAt < 150_000, 'top01_waste_retry_backlog_exceeded_150_seconds');
        await waitFor(
          'top01-waste-first-attempt-retrying',
          async () =>
            (await scalar(
              adminPool,
              "SELECT (status = 'retrying')::text AS value FROM iam.studio_jobs WHERE id = $1",
              [started.job.id]
            )) === 'true'
        );
        assert(getHandlerAttempts() === 1, 'top01_waste_first_attempt_count');
        await waitFor(
          'top01-waste-retry-keeps-privileged-queue',
          async () =>
            (await scalar(
              adminPool,
              `SELECT (queue_name = $2 AND task_identifier = 'studio_job_execute_privileged' AND attempts = 1)::text AS value
               FROM graphile_worker.jobs WHERE key = $1`,
              [`studio-job:${started.job.id}`, wasteProvisioning.queue]
            )) === 'true'
        );
        assert(
          Number(
            await scalar(
              adminPool,
              'SELECT attempts::text AS value FROM graphile_worker.jobs WHERE key = $1',
              [failingKey]
            )
          ) >= 2,
          'top01_default_plugin_backlog_disappeared_before_waste_attempt'
        );
        await waitFor(
          'top01-waste-retry-completed',
          async () =>
            (await scalar(
              adminPool,
              "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
              [started.job.id]
            )) === 'true'
        );
        assert(getHandlerAttempts() === 2, 'top01_waste_retry_attempt_count');
      } finally {
        await Promise.all([
          privilegedRunner?.gracefulShutdown() ?? Promise.resolve(),
          defaultRunner.gracefulShutdown(),
        ]);
        await privilegedWorkerPool.end();
      }
    }
  );
};

export const runQueueIsolation = async (context: MatrixContext): Promise<void> => {
  await runBlockedQueue(context);
  await runRetryBacklog(context);
};
