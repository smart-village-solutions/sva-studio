import { runTaskList } from './plugin-lifecycle-contract-database.js';
import { Pool } from './plugin-lifecycle-contract-database.js';
import {
  assert,
  database,
  instanceId,
  privilegedQueueName,
  queueName,
  scalar,
  waitFor,
  workerPassword,
} from './plugin-lifecycle-contract-base.js';
import type { ContractRunner } from './plugin-lifecycle-contract-base.js';
import { cleanLifecycle } from './plugin-lifecycle-contract-fixture.js';
import { configureRuntime } from './plugin-lifecycle-contract-runtime.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import {
  reportCase,
  spawnContractWorker,
  startLifecycle,
  waitForWorkerExit,
  waitForWorkerOutput,
} from './plugin-lifecycle-contract-worker.js';

const runTopologyPart1 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime, port } = context;
  await reportCase('TOP-01-negative-default-lane-cannot-claim-privileged-job', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'ready', 'privileged');
    const started = await startLifecycle(runtime);
    const defaultRunner = runTaskList(
      { concurrency: 1, noHandleSignals: true },
      runtime.createTaskList(runtime.registry, 'studio_job_execute'),
      workerPool
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    await defaultRunner.gracefulShutdown();
    assert(
      (await scalar(
        adminPool,
        "SELECT (status = 'queued')::text AS value FROM iam.studio_jobs WHERE id = $1",
        [started.job.id]
      )) === 'true',
      'top01_default_lane_claimed_privileged_job'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
        [`studio-job:${started.job.id}`]
      )) === '1',
      'top01_privileged_job_key_missing_after_default_lane'
    );

    const privilegedWorker = spawnContractWorker(port, started.job.id, 'run');
    await waitForWorkerOutput(privilegedWorker, 'WORKER_READY');
    const exit = await waitForWorkerExit(privilegedWorker);
    assert(exit.code === 0, `top01_privileged_worker_failed:${privilegedWorker.output.stderr}`);
    assert(
      (await scalar(
        adminPool,
        "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
        [started.job.id]
      )) === 'true',
      'top01_privileged_worker_did_not_consume_job'
    );
  });

  await reportCase('TOP-01-positive-existing-job-reroutes-to-current-queue', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'ready', 'privileged', queueName);
    const started = await startLifecycle(runtime);

    configureRuntime(runtime, 'contract-1', 'ready', 'privileged', privilegedQueueName);
    await runtime.ensure(instanceId);

    assert(
      (await scalar(
        adminPool,
        `SELECT (queue_name = $2)::text AS value
         FROM graphile_worker.jobs
         WHERE key = $1`,
        [`studio-job:${started.job.id}`, privilegedQueueName]
      )) === 'true',
      'top01_existing_job_not_rerouted_to_current_queue'
    );

    const privilegedRunner = runTaskList(
      { concurrency: 1, noHandleSignals: true },
      runtime.createTaskList(runtime.registry, 'studio_job_execute_privileged'),
      workerPool
    );
    try {
      await waitFor(
        'top01-existing-job-completed-after-queue-reroute',
        async () =>
          (await scalar(
            adminPool,
            "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
            [started.job.id]
          )) === 'true'
      );
    } finally {
      await privilegedRunner.gracefulShutdown();
    }
  });
};

const runTopologyPart2 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime, port } = context;
  await reportCase(
    'TOP-01-positive-privileged-queue-progresses-while-default-queue-blocked',
    async () => {
      await cleanLifecycle(adminPool);
      configureRuntime(runtime, 'contract-1', 'ready', 'privileged', privilegedQueueName);

      let defaultJobStarted = false;
      let releaseDefaultJob = (): void => undefined;
      const defaultJobRelease = new Promise<void>((resolve) => {
        releaseDefaultJob = resolve;
      });
      await adminPool.query(
        `SELECT graphile_worker.sva_enqueue_job(
           'studio_job_execute', '{}'::json, $1, 1, 'studio-job:top01-default-blocker', now()
         )`,
        [queueName]
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
      const privilegedWorkerPool = new Pool({
        connectionString: `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`,
        max: 2,
        idleTimeoutMillis: 5_000,
        statement_timeout: 10_000,
        idle_in_transaction_session_timeout: 10_000,
      });
      let privilegedRunner: ContractRunner | undefined;
      try {
        await waitFor('top01-default-queue-blocker-started', async () => defaultJobStarted);
        const started = await startLifecycle(runtime);
        privilegedRunner = runTaskList(
          { concurrency: 1, noHandleSignals: true },
          runtime.createTaskList(runtime.registry, 'studio_job_execute_privileged'),
          privilegedWorkerPool
        );
        await waitFor(
          'top01-privileged-job-completed-while-default-queue-blocked',
          async () =>
            (await scalar(
              adminPool,
              "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
              [started.job.id]
            )) === 'true'
        );
        assert(
          defaultJobStarted,
          'top01_privileged_job_completed_without_default_queue_contention'
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

  await reportCase('TOP-01-positive-crash-recovery-without-http-request', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'ready', 'privileged');
    const started = await startLifecycle(
      runtime,
      'provision',
      new Date(Date.now() + 10_000).toISOString()
    );
    const crashedWorker = spawnContractWorker(port, started.job.id, 'hold');
    await waitForWorkerOutput(crashedWorker, 'WORKER_READY');
    crashedWorker.child.kill('SIGKILL');
    const crashExit = await waitForWorkerExit(crashedWorker);
    assert(crashExit.signal === 'SIGKILL', 'top01_worker_process_did_not_crash');
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
        [`studio-job:${started.job.id}`]
      )) === '1',
      'top01_persistent_job_key_after_crash'
    );

    const restartedWorker = spawnContractWorker(port, started.job.id, 'run');
    await waitForWorkerOutput(restartedWorker, 'WORKER_READY');
    const restartExit = await waitForWorkerExit(restartedWorker);
    assert(
      restartExit.code === 0,
      `top01_restarted_worker_failed:${restartedWorker.output.stderr}`
    );
    assert(
      (await scalar(
        adminPool,
        "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
        [started.job.id]
      )) === 'true',
      'top01_original_scheduled_job_completed_after_restart'
    );
  });
};

const runTopologyPart3 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, runtime, port } = context;
  await reportCase('TOP-01-negative-clean-shutdown-is-not-restarted', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'ready', 'privileged');
    const started = await startLifecycle(
      runtime,
      'provision',
      new Date(Date.now() + 60_000).toISOString()
    );
    const stoppedWorker = spawnContractWorker(port, started.job.id, 'shutdown');
    await waitForWorkerOutput(stoppedWorker, 'WORKER_READY');
    const stopExit = await waitForWorkerExit(stoppedWorker);
    assert(stopExit.code === 0, `top01_clean_shutdown_failed:${stoppedWorker.output.stderr}`);
    assert(
      stoppedWorker.output.stdout.includes('WORKER_STOPPED'),
      'top01_clean_shutdown_not_observed'
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    assert(
      (await scalar(
        adminPool,
        "SELECT (status = 'queued')::text AS value FROM iam.studio_jobs WHERE id = $1",
        [started.job.id]
      )) === 'true',
      'top01_clean_shutdown_not_restarted'
    );
  });
};

export const runTopology = async (context: MatrixContext): Promise<void> => {
  await runTopologyPart1(context);
  await runTopologyPart2(context);
  await runTopologyPart3(context);
};
