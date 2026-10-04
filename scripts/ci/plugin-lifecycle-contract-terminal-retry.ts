import { assert, instanceId, pluginId, scalar } from './plugin-lifecycle-contract-base.js';
import {
  cleanLifecycle,
  failpointHits,
  setFailpoint,
} from './plugin-lifecycle-contract-fixture.js';
import { configureRuntime } from './plugin-lifecycle-contract-runtime.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import {
  assertPersistedPendingRetry,
  assertPersistedTerminalOutcome,
  reportCase,
  runWorkerAcrossExplicitRestart,
  runWorkerUntil,
  startLifecycle,
} from './plugin-lifecycle-contract-worker.js';

const runTerminalRetryPart1 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime } = context;
  configureRuntime(runtime);

  await reportCase('LC-04-positive-real-tasklist-terminal-commit', async () => {
    await cleanLifecycle(adminPool);
    const started = await startLifecycle(runtime);
    await runWorkerUntil(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [started.job.id]
        )) === 'true'
    );
    assert(
      (await scalar(
        adminPool,
        "SELECT count(*)::text AS value FROM iam.studio_job_events WHERE job_id = $1 AND event_type = 'job.succeeded'",
        [started.job.id]
      )) === '1',
      'terminal_event'
    );
    assert(
      (await scalar(
        adminPool,
        "SELECT (readiness_status = 'ready' AND active_job_id IS NULL)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
        [instanceId, pluginId]
      )) === 'true',
      'terminal_lifecycle'
    );
  });

  for (const failpoint of [
    'after_lifecycle_terminal',
    'after_terminal_job_status',
    'after_terminal_event',
  ] as const) {
    await reportCase(`LC-04-negative-${failpoint}-redelivery`, async () => {
      await cleanLifecycle(adminPool);
      await setFailpoint(adminPool, failpoint);
      const started = await startLifecycle(runtime);
      await runWorkerAcrossExplicitRestart(
        runtime,
        workerPool,
        async () => Number(await failpointHits(adminPool)) >= 1,
        async () =>
          (await scalar(
            adminPool,
            "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
            [started.job.id]
          )) === 'true'
      );
      assert(
        Number(await failpointHits(adminPool)) >= 2,
        `terminal_failpoint_redelivered:${failpoint}`
      );
      await assertPersistedTerminalOutcome(adminPool, {
        jobId: started.job.id,
        generation: started.lifecycle.desiredGeneration,
        status: 'succeeded',
        eventType: 'job.succeeded',
      });
    });
  }
};

const runTerminalRetryPart2 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime } = context;
  await reportCase('LC-03-positive-pending-has-retry-wakeup', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'pending');
    const started = await startLifecycle(runtime);
    await runWorkerUntil(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [started.job.id]
        )) === 'true'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
        [`plugin-tenant-lifecycle-retry:${instanceId}:${pluginId}`]
      )) === '1',
      'pending_retry_wakeup'
    );
    configureRuntime(runtime, 'contract-1', 'ready');
    await adminPool.query(
      "UPDATE iam.instance_plugin_lifecycle SET next_recheck_at = now() - interval '1 second' WHERE instance_id = $1 AND plugin_id = $2",
      [instanceId, pluginId]
    );
    await runtime.ensure(instanceId);
    const nextJobId = await scalar(
      adminPool,
      'SELECT active_job_id::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2',
      [instanceId, pluginId]
    );
    assert(nextJobId && nextJobId !== started.job.id, 'pending_ready_new_internal_generation');
    await runWorkerUntil(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (readiness_status = 'ready' AND active_job_id IS NULL)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
          [instanceId, pluginId]
        )) === 'true'
    );
  });

  await reportCase('LC-03-negative-retry-enqueue-rolls-back-terminal-state', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'pending');
    await setFailpoint(adminPool, 'after_retry_enqueue');
    const started = await startLifecycle(runtime);
    await runWorkerAcrossExplicitRestart(
      runtime,
      workerPool,
      async () => Number(await failpointHits(adminPool)) >= 1,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [started.job.id]
        )) === 'true'
    );
    assert(Number(await failpointHits(adminPool)) >= 2, 'retry_enqueue_redelivery');
    await assertPersistedPendingRetry(adminPool, {
      jobId: started.job.id,
      generation: started.lifecycle.desiredGeneration,
    });
  });
};

export const runTerminalRetry = async (context: MatrixContext): Promise<void> => {
  await runTerminalRetryPart1(context);
  await runTerminalRetryPart2(context);
};
