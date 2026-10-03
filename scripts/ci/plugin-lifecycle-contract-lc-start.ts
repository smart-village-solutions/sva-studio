import { assert, instanceId, pluginId, scalar } from './plugin-lifecycle-contract-base.js';
import {
  cleanLifecycle,
  failpointHits,
  setFailpoint,
} from './plugin-lifecycle-contract-fixture.js';
import { configureRuntime, setHandlerEffectDatabase } from './plugin-lifecycle-contract-runtime.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import { reportCase, startLifecycle } from './plugin-lifecycle-contract-worker.js';

const runLcStartPart1 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, runtime } = context;
  setHandlerEffectDatabase(adminPool);

  configureRuntime(runtime);

  const enqueueProbe = await adminPool.connect();

  try {
    await enqueueProbe.query('BEGIN');
    await enqueueProbe.query('SET LOCAL ROLE iam_app');
    await enqueueProbe.query(
      "SELECT graphile_worker.sva_enqueue_job('studio_job_execute', '{}'::json, 'plugin-operations', 1, 'studio-job:lifecycle-probe', now())"
    );
    await enqueueProbe.query('ROLLBACK');
  } catch (error) {
    await enqueueProbe.query('ROLLBACK');
    throw error;
  } finally {
    enqueueProbe.release?.();
  }

  await reportCase('LC-01-positive-parallel-start-single-owner', async () => {
    await cleanLifecycle(adminPool);
    const results = await Promise.allSettled([startLifecycle(runtime), startLifecycle(runtime)]);
    assert(
      results.filter(({ status }) => status === 'fulfilled').length === 1,
      `parallel_owner:${results
        .map((result) =>
          result.status === 'fulfilled'
            ? 'fulfilled'
            : result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
        )
        .join('|')}`
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1',
        [instanceId]
      )) === '1',
      'parallel_lifecycle_count'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.studio_jobs WHERE instance_id = $1',
        [instanceId]
      )) === '1',
      'parallel_job_count'
    );
  });

  await reportCase('LC-01-negative-active-owner-rejects-new-start', async () => {
    await cleanLifecycle(adminPool);
    await startLifecycle(runtime);
    await startLifecycle(runtime).then(
      () => {
        throw new Error('second_start_unexpected_success');
      },
      () => undefined
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM iam.studio_jobs WHERE instance_id = $1',
        [instanceId]
      )) === '1',
      'active_owner_job_count'
    );
  });
};

const runLcStartPart2 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, runtime } = context;
  for (const failpoint of ['after_request', 'after_job', 'after_claim', 'after_enqueue'] as const) {
    await reportCase(`LC-02-negative-${failpoint}`, async () => {
      await cleanLifecycle(adminPool);
      await setFailpoint(adminPool, failpoint);
      await startLifecycle(runtime).then(
        () => {
          throw new Error(`unreached_failpoint:${failpoint}`);
        },
        (error: unknown) => {
          assert(
            String(error).includes('plugin_tenant_lifecycle') ||
              String(error).includes('failpoint'),
            `failpoint_error:${failpoint}`
          );
        }
      );
      assert((await failpointHits(adminPool)) === '1', `failpoint_not_reached:${failpoint}`);
      assert(
        (await scalar(
          adminPool,
          'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1',
          [instanceId]
        )) === '0',
        `lifecycle_rollback:${failpoint}`
      );
      assert(
        (await scalar(
          adminPool,
          'SELECT count(*)::text AS value FROM iam.studio_jobs WHERE instance_id = $1',
          [instanceId]
        )) === '0',
        `job_rollback:${failpoint}`
      );
    });
  }

  await reportCase('LC-02-positive-claim-has-execution-and-recovery', async () => {
    await cleanLifecycle(adminPool);
    const started = await startLifecycle(runtime);
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key IN ($1, $2)',
        [
          `studio-job:${started.job.id}`,
          `plugin-tenant-lifecycle-recovery:${instanceId}:${pluginId}`,
        ]
      )) === '2',
      'persistent_wakeups'
    );
  });
};

export const runLcStart = async (context: MatrixContext): Promise<void> => {
  await runLcStartPart1(context);
  await runLcStartPart2(context);
};
