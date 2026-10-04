import {
  activationPluginId,
  assert,
  instanceId,
  pluginId,
} from './plugin-lifecycle-contract-base.js';
import type { ContractPool } from './plugin-lifecycle-contract-base.js';

export const reconcileActivationAndIam = async (pool: ContractPool): Promise<void> => {
  const data = await import('@sva/data-repositories');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE iam_app');
    await client.query('SELECT set_config($1, $2, true)', ['app.instance_id', instanceId]);
    const repository = data.createInstanceRegistryRepository({
      execute: async <TRow>(statement: { text: string; values?: readonly unknown[] }) => {
        const result = await client.query<TRow>(statement.text, statement.values);
        return { rowCount: result.rowCount ?? 0, rows: result.rows };
      },
    });
    const result = await repository.reconcileModuleActivationPolicies({
      instanceId,
      policies: [
        {
          moduleId: activationPluginId,
          activationPolicy: 'automatic',
          manifestVersion: 1,
          policyRevision: 'act-contract-1',
        },
      ],
      preservedModuleIds: [pluginId],
      reconcileId: 'act-reconcile-1',
      actorId: 'contract',
    });
    assert(result.conflictModuleIds.length === 0, 'act01_activation_conflict');
    const contract = {
      moduleId: activationPluginId,
      permissionIds: [`${activationPluginId}.read`],
      permissions: [
        {
          key: `${activationPluginId}.read`,
          description: 'Lifecycle contract read permission',
          resourceType: activationPluginId,
        },
      ],
    };
    await repository.syncAssignedModuleIam({
      instanceId,
      managedModuleIds: [activationPluginId],
      managedContracts: [contract],
      contracts: [contract],
    });
    await repository.persistPluginTenantLifecycleReconcileIntents({
      instanceId,
      lifecycles: [{ pluginId: activationPluginId, contractRevision: 'act-contract-1:1' }],
      forcePluginIds: [activationPluginId],
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release?.();
  }
};

export const transitionJobForRecovery = async (
  pool: ContractPool,
  jobId: string,
  status: 'running' | 'retrying'
): Promise<void> => {
  const data = await import('@sva/data-repositories');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE iam_app');
    await client.query('SELECT set_config($1, $2, true)', ['app.instance_id', instanceId]);
    const repository = data.createStudioJobRepository({
      execute: async <TRow>(statement: { text: string; values?: readonly unknown[] }) => {
        const result = await client.query<TRow>(statement.text, statement.values);
        return { rowCount: result.rowCount ?? 0, rows: result.rows };
      },
    });
    const staleAt = new Date(Date.now() - 180_000).toISOString();
    const transition = await repository.transitionJobState({
      jobId,
      instanceId,
      status,
      attempts: 1,
      startedAt: staleAt,
      heartbeatAt: staleAt,
      ...(status === 'running' ? { workerId: 'lost-worker' } : {}),
      expectedStatuses: ['queued'],
      expectedAttempts: 0,
      expectedWorkerId: null,
    });
    assert(transition.outcome === 'applied', `recovery_fixture_${status}`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release?.();
  }
};

export const persistLifecycleFailureEvidence = async (
  pool: ContractPool,
  jobId: string,
  generation: number,
  retryKind: 'retryable' | 'terminal'
): Promise<void> => {
  const data = await import('@sva/data-repositories');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE iam_app');
    await client.query('SELECT set_config($1, $2, true)', ['app.instance_id', instanceId]);
    const execute = async <TRow>(statement: { text: string; values?: readonly unknown[] }) => {
      const result = await client.query<TRow>(statement.text, statement.values);
      return { rowCount: result.rowCount ?? 0, rows: result.rows };
    };
    const lifecycleRepository = data.createPluginTenantLifecycleRepository({ execute });
    const jobRepository = data.createStudioJobRepository({ execute });
    const failure = await lifecycleRepository.failLifecycle({
      instanceId,
      pluginId,
      jobId,
      generation,
      readinessStatus: 'blocked',
      errorCode: `contract-${retryKind}`,
      retryKind,
      ...(retryKind === 'retryable' ? { retryAfter: '2999-01-01T00:00:00.000Z' } : {}),
    });
    assert(failure.outcome === 'applied', `contract_failure_evidence_${retryKind}`);
    const failedJob = await jobRepository.updateJobState({
      jobId,
      instanceId,
      status: 'failed',
      attempts: 0,
      finishedAt: new Date().toISOString(),
      errorPayload: {
        code: `contract_${retryKind}`,
        category: retryKind === 'retryable' ? 'retryable' : 'permanent',
      },
    });
    assert(failedJob?.status === 'failed', `contract_failed_job_${retryKind}`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release?.();
  }
};
