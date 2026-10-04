import { randomUUID } from 'node:crypto';

import {
  assert,
  instanceId,
  pluginId,
  queueName,
  scalar,
} from './plugin-lifecycle-contract-base.js';
import { cleanLifecycle } from './plugin-lifecycle-contract-fixture.js';
import { persistLifecycleFailureEvidence } from './plugin-lifecycle-contract-recovery.js';
import { configureRuntime } from './plugin-lifecycle-contract-runtime.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import {
  assertPersistedTerminalOutcome,
  reportCase,
  runWorkerUntil,
  startLifecycle,
} from './plugin-lifecycle-contract-worker.js';

const runGenerationPart1 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime } = context;
  await reportCase('LC-03-negative-final-attempt-has-terminal-state-not-wakeup', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'always-fail');
    const started = await startLifecycle(runtime);
    await adminPool.query('UPDATE iam.studio_jobs SET max_attempts = 1 WHERE id = $1', [
      started.job.id,
    ]);
    await adminPool.query(
      'UPDATE graphile_worker._private_jobs SET max_attempts = 1 WHERE key = $1',
      [`studio-job:${started.job.id}`]
    );
    await runWorkerUntil(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'failed')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [started.job.id]
        )) === 'true'
    );
    await assertPersistedTerminalOutcome(adminPool, {
      jobId: started.job.id,
      generation: started.lifecycle.desiredGeneration,
      status: 'failed',
      eventType: 'job.failed',
    });
    assert(
      (await scalar(
        adminPool,
        "SELECT (readiness_status = 'blocked' AND retry_kind = 'terminal')::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
        [instanceId, pluginId]
      )) === 'true',
      'final_attempt_terminal_lifecycle'
    );
    assert(
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
        [`plugin-tenant-lifecycle-retry:${instanceId}:${pluginId}`]
      )) === '0',
      'final_attempt_retry_key_absent'
    );
  });

  await reportCase('LC-05-positive-terminal-redelivery-is-idempotent', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime);
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
    await adminPool.query(
      "SELECT graphile_worker.sva_enqueue_job('studio_job_execute', $1::json, $2, 1, $3, now())",
      [
        JSON.stringify({ instanceId, jobId: started.job.id }),
        queueName,
        `studio-job:redelivery:${started.job.id}`,
      ]
    );
    await runWorkerUntil(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1',
          [`studio-job:redelivery:${started.job.id}`]
        )) === '0'
    );
    assert(
      (await scalar(
        adminPool,
        "SELECT count(*)::text AS value FROM iam.studio_job_events WHERE job_id = $1 AND event_type = 'job.succeeded'",
        [started.job.id]
      )) === '1',
      'redelivery_terminal_count'
    );
    await assertPersistedTerminalOutcome(adminPool, {
      jobId: started.job.id,
      generation: started.lifecycle.desiredGeneration,
      status: 'succeeded',
      eventType: 'job.succeeded',
      executionKey: `studio-job:redelivery:${started.job.id}`,
    });
  });
};

const runGenerationPart2 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime } = context;
  await reportCase('LC-05-negative-stale-generation-cannot-overwrite', async () => {
    const lifecycleBefore = await adminPool.query<{
      completed_generation: string;
      readiness_revision: string;
    }>(
      'SELECT completed_generation::text, readiness_revision FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2',
      [instanceId, pluginId]
    );
    assert(lifecycleBefore.rows[0]?.completed_generation === '1', 'stale_fixture_generation');
    const staleJobId = randomUUID();
    const data = await import('@sva/data-repositories');
    const client = await adminPool.connect();
    try {
      await client.query('BEGIN');
      const repository = data.createPluginTenantLifecycleRepository({
        execute: async <TRow>(statement: { text: string; values?: readonly unknown[] }) => {
          const result = await client.query<TRow>(statement.text, statement.values);
          return { rowCount: result.rowCount ?? 0, rows: result.rows };
        },
      });
      const stale = await repository.completeLifecycle({
        instanceId,
        pluginId,
        jobId: staleJobId,
        generation: 1,
        operation: 'provision',
        readinessStatus: 'blocked',
        readinessRevision: 'stale',
        readinessChecks: [],
      });
      assert(stale.outcome === 'alreadyApplied' || stale.outcome === 'conflict', 'stale_outcome');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release?.();
    }
    const revision = await scalar(
      adminPool,
      'SELECT readiness_revision AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2',
      [instanceId, pluginId]
    );
    assert(revision === lifecycleBefore.rows[0]?.readiness_revision, 'stale_revision_unchanged');
  });

  await reportCase('LC-06-positive-contract-upgrade-overrides-retryable-evidence', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1');
    const baseline = await startLifecycle(runtime);
    await runWorkerUntil(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [baseline.job.id]
        )) === 'true'
    );
    const started = await startLifecycle(runtime, 'reconcile');
    await persistLifecycleFailureEvidence(
      adminPool,
      started.job.id,
      started.lifecycle.desiredGeneration,
      'retryable'
    );
    configureRuntime(runtime, 'contract-2');
    await runtime.ensure(instanceId);
    assert(
      (await scalar(
        adminPool,
        "SELECT (desired_generation = 3 AND desired_operation = 'reconcile' AND active_job_id IS NOT NULL AND retry_kind IS NULL)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
        [instanceId, pluginId]
      )) === 'true',
      'contract_upgrade_retryable_reconcile'
    );
  });

  await reportCase('LC-06-negative-old-terminal-evidence-not-reused', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1');
    const baseline = await startLifecycle(runtime);
    await runWorkerUntil(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [baseline.job.id]
        )) === 'true'
    );
    const started = await startLifecycle(runtime, 'reconcile');
    await persistLifecycleFailureEvidence(
      adminPool,
      started.job.id,
      started.lifecycle.desiredGeneration,
      'terminal'
    );
    configureRuntime(runtime, 'contract-2');
    await runtime.ensure(instanceId);
    assert(
      (await scalar(
        adminPool,
        "SELECT (desired_generation = 3 AND desired_operation = 'reconcile' AND active_job_id IS NOT NULL AND retry_kind IS NULL)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
        [instanceId, pluginId]
      )) === 'true',
      'old_terminal_not_reused'
    );
  });
};

export const runGeneration = async (context: MatrixContext): Promise<void> => {
  await runGenerationPart1(context);
  await runGenerationPart2(context);
};
