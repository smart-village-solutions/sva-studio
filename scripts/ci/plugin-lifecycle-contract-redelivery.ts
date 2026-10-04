import {
  assert,
  instanceId,
  jobTypeId,
  pluginId,
  scalar,
} from './plugin-lifecycle-contract-base.js';
import {
  cleanLifecycle,
  failpointHits,
  setFailpoint,
} from './plugin-lifecycle-contract-fixture.js';
import { transitionJobForRecovery } from './plugin-lifecycle-contract-recovery.js';
import { configureRuntime, getHandlerAttempts } from './plugin-lifecycle-contract-runtime.js';
import type { MatrixContext } from './plugin-lifecycle-contract-runtime.js';
import {
  assertPersistedTerminalOutcome,
  reportCase,
  runWorkerAcrossExplicitRestart,
  runWorkerUntil,
  startLifecycle,
} from './plugin-lifecycle-contract-worker.js';

const runRedeliveryPart1 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime } = context;
  await reportCase('LC-04-negative-invalid-handler-result-is-terminal', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'invalid');
    const started = await startLifecycle(runtime);
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
    assert(
      (await scalar(
        adminPool,
        "SELECT (readiness_status = 'blocked' AND retry_kind = 'terminal')::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
        [instanceId, pluginId]
      )) === 'true',
      'invalid_result_terminalized'
    );
  });

  await reportCase('LC-04-negative-malformed-handler-result-is-terminal', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'malformed');
    const started = await startLifecycle(runtime);
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
    assert(
      (await scalar(
        adminPool,
        "SELECT (readiness_status = 'blocked' AND retry_kind = 'terminal')::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
        [instanceId, pluginId]
      )) === 'true',
      'malformed_result_terminalized'
    );
  });

  await reportCase('LC-05-positive-redelivery-after-idempotent-domain-effect', async () => {
    await cleanLifecycle(adminPool);
    await adminPool.query('TRUNCATE lifecycle_contract.effects');
    configureRuntime(runtime, 'contract-1', 'idempotent-effect');
    await setFailpoint(adminPool, 'after_terminal_event');
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
      (await scalar(
        adminPool,
        'SELECT count(*)::text AS value FROM lifecycle_contract.effects WHERE effect_key = $1',
        [`${instanceId}:${pluginId}`]
      )) === '1',
      'domain_effect_unique'
    );
    assert(
      Number(
        await scalar(
          adminPool,
          'SELECT deliveries::text AS value FROM lifecycle_contract.effects WHERE effect_key = $1',
          [`${instanceId}:${pluginId}`]
        )
      ) === 2,
      'domain_effect_redelivered'
    );
    await assertPersistedTerminalOutcome(adminPool, {
      jobId: started.job.id,
      generation: started.lifecycle.desiredGeneration,
      status: 'succeeded',
      eventType: 'job.succeeded',
    });
  });
};

const runRedeliveryPart2 = async (context: MatrixContext): Promise<void> => {
  const { adminPool, workerPool, runtime } = context;
  await reportCase('GRAPHILE-prerequisite-retrying-explicit-worker-stop-start', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime, 'contract-1', 'retry-once');
    const started = await startLifecycle(runtime);
    await runWorkerAcrossExplicitRestart(
      runtime,
      workerPool,
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'retrying')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [started.job.id]
        )) === 'true',
      async () =>
        (await scalar(
          adminPool,
          "SELECT (status = 'succeeded')::text AS value FROM iam.studio_jobs WHERE id = $1",
          [started.job.id]
        )) === 'true'
    );
    assert(getHandlerAttempts() === 2, 'retrying_redelivery_attempts');
  });

  await reportCase('GRAPHILE-prerequisite-lost-running-claim-lease-recovery', async () => {
    await cleanLifecycle(adminPool);
    configureRuntime(runtime);
    const started = await startLifecycle(runtime);
    await transitionJobForRecovery(adminPool, started.job.id, 'running');
    const data = await import('@sva/data-repositories');
    const lifecycleRepository = data.createPluginTenantLifecycleRepository({
      execute: async <TRow>(statement: { text: string; values?: readonly unknown[] }) => {
        const result = await adminPool.query<TRow>(statement.text, statement.values);
        return { rowCount: result.rowCount ?? 0, rows: result.rows };
      },
    });
    const lifecycle = await lifecycleRepository.getLifecycle(instanceId, pluginId);
    assert(lifecycle?.activeJobId === started.job.id, 'lost_claim_fixture');
    const recovery =
      await import('../../packages/auth-runtime/src/plugin-tenant-lifecycle/enqueue-recovery.js');
    await recovery.reconcileClaimedLifecycleJob({
      instanceId,
      definition: {
        pluginId,
        contractVersion: 1,
        contractRevision: 'contract-1:1',
        operations: [
          { operation: 'provision', jobTypeId },
          { operation: 'reconcile', jobTypeId },
        ],
        readinessChecks: [
          { checkId: `${pluginId}.database`, titleKey: 'contract', required: true },
        ],
      },
      lifecycle: { ...lifecycle, activeJobId: lifecycle.activeJobId },
    });
    assert(
      (await scalar(
        adminPool,
        "SELECT (status = 'failed')::text AS value FROM iam.studio_jobs WHERE id = $1",
        [started.job.id]
      )) === 'true',
      'lost_claim_job_fenced'
    );
    assert(
      (await scalar(
        adminPool,
        "SELECT (retry_kind = 'retryable' AND active_job_id IS NULL)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2",
        [instanceId, pluginId]
      )) === 'true',
      'lost_claim_lifecycle_recoverable'
    );
  });
};

export const runRedelivery = async (context: MatrixContext): Promise<void> => {
  await runRedeliveryPart1(context);
  await runRedeliveryPart2(context);
};
