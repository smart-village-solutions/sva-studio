const instanceId = '00000000-0000-4000-8000-000000000040';
const pluginId = 'fault-plugin';
const jobTypeId = 'fault-plugin.provision';
const queueName = 'plugin-tenant-lifecycle-contract';

const mode = process.env.SVA_LIFECYCLE_CONTRACT_WORKER_MODE;
const jobId = process.env.SVA_LIFECYCLE_CONTRACT_JOB_ID;

if (mode !== 'hold' && mode !== 'run' && mode !== 'shutdown') {
  throw new Error('plugin_lifecycle_worker_fixture_mode_invalid');
}
if (!jobId) throw new Error('plugin_lifecycle_worker_fixture_job_id_missing');

const snapshot =
  await import('../../../packages/auth-runtime/src/iam-instance-registry/plugin-activation-policy-snapshot.js');
const registry =
  await import('../../../packages/auth-runtime/src/plugin-operations/runner-registry.js');
const worker =
  await import('../../../packages/auth-runtime/src/plugin-operations/runner-worker.js');
const database = await import('../../../packages/auth-runtime/src/db.js');

snapshot.configureInstanceRegistryPluginRuntimeSnapshot({
  activationPolicies: {
    revision: 'contract-1',
    modules: [
      {
        moduleId: pluginId,
        activationPolicy: 'automatic',
        manifestVersion: 1,
        policyRevision: 'contract-1',
      },
    ],
  },
  moduleIamContracts: [],
  tenantLifecycles: [
    {
      pluginId,
      contractVersion: 1,
      operations: [
        { operation: 'provision', jobTypeId },
        { operation: 'reconcile', jobTypeId },
      ],
      readinessChecks: [{ checkId: `${pluginId}.database`, titleKey: 'contract', required: true }],
    },
  ],
});
registry.registerPluginOperationExecutionHandlers({
  [jobTypeId]: {
    queueName,
    executionLane: 'privileged',
    handler: async () => ({
      tenantLifecycle: {
        revision: 'database-1',
        checks: [{ checkId: `${pluginId}.database`, status: 'ready' }],
      },
    }),
  },
});

await worker.ensurePrivilegedStudioJobWorkerStarted({
  onTerminalFailure: () => process.exit(1),
});
process.stdout.write('WORKER_READY\n');

if (mode === 'shutdown') {
  await worker.stopPrivilegedStudioJobWorker();
  process.stdout.write('WORKER_STOPPED\n');
  process.exit(0);
}

if (mode === 'run') {
  const pool = database.resolvePool();
  if (!pool) throw new Error('plugin_lifecycle_worker_fixture_database_unavailable');
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await pool.query<{ status: string }>(
      'SELECT status FROM iam.studio_jobs WHERE id = $1',
      [jobId]
    );
    if (result.rows[0]?.status === 'succeeded') {
      await worker.stopPrivilegedStudioJobWorker();
      process.stdout.write('WORKER_COMPLETED\n');
      process.exit(0);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('plugin_lifecycle_worker_fixture_completion_timeout');
}

await new Promise<never>(() => undefined);
