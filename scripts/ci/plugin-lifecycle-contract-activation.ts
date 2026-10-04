import {
  activationPluginId,
  assert,
  instanceId,
  scalar,
} from './plugin-lifecycle-contract-base.js';
import {
  cleanActivation,
  cleanLifecycle,
  failpointHits,
  setFailpoint,
} from './plugin-lifecycle-contract-fixture.js';
import { reconcileActivationAndIam } from './plugin-lifecycle-contract-recovery.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import { reportCase, runWorkerUntil, startLifecycle } from './plugin-lifecycle-contract-worker.js';

export const runActivation = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime } = context;
  await reportCase('ACT-01-positive-activation-iam-and-reconcile-intent', async () => {
    await cleanActivation(adminPool);
    await reconcileActivationAndIam(adminPool);
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.instance_modules WHERE instance_id = $1 AND module_id = $2 AND effective_active',
        [instanceId, activationPluginId]
      )) === '1',
      'act01_activation'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.permissions WHERE instance_id = $1 AND permission_key = $2',
        [instanceId, `${activationPluginId}.read`]
      )) === '1',
      'act01_iam'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2',
        [instanceId, activationPluginId]
      )) === '1',
      'act01_intent'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
        [`plugin-tenant-lifecycle-activation:${instanceId}:${activationPluginId}`]
      )) === '1',
      'act01_reconcile_key'
    );
  });

  await reportCase('ACT-01-negative-rollback-after-iam-materialization', async () => {
    await cleanActivation(adminPool);
    await setFailpoint(adminPool, 'after_iam_materialization');
    await reconcileActivationAndIam(adminPool).catch(() => undefined);
    assert((await failpointHits(adminPool)) === '1', 'act01_iam_failpoint');
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.instance_modules WHERE instance_id = $1 AND module_id = $2',
        [instanceId, activationPluginId]
      )) === '0',
      'act01_activation_rollback'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.permissions WHERE instance_id = $1 AND permission_key = $2',
        [instanceId, `${activationPluginId}.read`]
      )) === '0',
      'act01_iam_rollback'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2',
        [instanceId, activationPluginId]
      )) === '0',
      'act01_intent_rollback'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
        [`plugin-tenant-lifecycle-activation:${instanceId}:${activationPluginId}`]
      )) === '0',
      'act01_reconcile_key_rollback'
    );
  });

  await reportCase('GRAPHILE-prerequisite-queued-survives-worker-absence-then-start', async () => {
    await cleanLifecycle(adminPool);
    const started = await startLifecycle(runtime);
    assert(
      (await scalar(
        adminPool,
        "SELECT (status = 'queued')::text AS value FROM iam.studio_jobs WHERE id = $1",
        [started.job.id]
      )) === 'true',
      'queued_before_worker_start'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
        [`studio-job:${started.job.id}`]
      )) === '1',
      'queued_graphile_job_before_worker_start'
    );
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
  });
};
