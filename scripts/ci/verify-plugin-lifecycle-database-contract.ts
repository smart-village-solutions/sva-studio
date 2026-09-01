import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const rootDir = process.cwd();
const containerName = `sva-lifecycle-contract-${process.pid}-${randomUUID().slice(0, 8)}`;
const database = 'sva_studio';
const adminPassword = 'lifecycle-contract-admin';
const appPassword = 'lifecycle-contract-app';
const workerPassword = 'lifecycle-contract-worker';
const instanceId = '00000000-0000-4000-8000-000000000040';
const pluginId = 'fault-plugin';
const activationPluginId = 'act-plugin';
const observabilityOtherInstanceId = '00000000-0000-4000-8000-000000000041';
const jobTypeId = 'fault-plugin.provision';
const queueName = 'plugin-tenant-lifecycle-contract';
const contractWorkerProcesses = new Set<ReturnType<typeof spawn>>();
let handlerAttempts = 0;
let handlerEffectDatabase: QueryClient | undefined;
const requireFromAuthRuntime = createRequire(
  createRequire(import.meta.url).resolve('@sva/auth-runtime')
);

type QueryResult<TRow> = { readonly rowCount: number | null; readonly rows: TRow[] };
type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
  release?: () => void;
};
type ContractPool = QueryClient & {
  connect(): Promise<QueryClient>;
  end(): Promise<void>;
};
type ContractRunner = { gracefulShutdown(): Promise<void> };

const { Pool } = requireFromAuthRuntime('pg') as {
  Pool: new (options: {
    connectionString: string;
    max: number;
    idleTimeoutMillis: number;
    statement_timeout: number;
    idle_in_transaction_session_timeout: number;
  }) => ContractPool;
};
const { runTaskList } = requireFromAuthRuntime('graphile-worker') as {
  runTaskList(
    options: { concurrency: number; noHandleSignals: boolean },
    taskList: Record<string, (payload: unknown, helpers: unknown) => Promise<void>>,
    pool: ContractPool
  ): ContractRunner;
};

const run = (command: string, args: readonly string[], env = process.env): string =>
  execFileSync(command, [...args], {
    cwd: rootDir,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const waitForPostgres = (port: string): void => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = spawnSync(
      'pg_isready',
      ['--host', '127.0.0.1', '--port', port, '--username', 'postgres', '--dbname', database],
      { env: { ...process.env, PGPASSWORD: adminPassword }, stdio: 'ignore' }
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error('plugin_lifecycle_contract_postgres_not_ready');
};

const startDatabase = (): string => {
  run('docker', [
    'run',
    '--rm',
    '--detach',
    '--name',
    containerName,
    '--env',
    `POSTGRES_PASSWORD=${adminPassword}`,
    '--env',
    `POSTGRES_DB=${database}`,
    '--publish',
    '127.0.0.1::5432',
    'postgres:16-alpine',
  ]);
  const port = run('docker', ['port', containerName, '5432/tcp']).split(':').at(-1)?.trim();
  if (!port) throw new Error('plugin_lifecycle_contract_postgres_port_missing');
  waitForPostgres(port);
  return port;
};

const migrationEnvironment = (port: string): NodeJS.ProcessEnv => ({
  ...process.env,
  POSTGRES_DB: database,
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PASSWORD: adminPassword,
  POSTGRES_PORT: port,
  POSTGRES_USER: 'postgres',
  SVA_LOCAL_POSTGRES_CONTAINER_NAME: containerName,
});

const migrateDatabase = (port: string): void => {
  const migrationEnv = migrationEnvironment(port);
  run('bash', ['packages/data/scripts/run-migrations.sh', 'up'], migrationEnv);
  run('node', ['deploy/portainer/migrate-graphile-worker.mjs'], migrationEnv);
  run('bash', ['deploy/portainer/bootstrap-entrypoint.sh'], {
    ...migrationEnv,
    APP_DB_PASSWORD: appPassword,
    APP_DB_USER: 'sva_app',
    STUDIO_JOB_WORKER_DB_PASSWORD: workerPassword,
    STUDIO_JOB_WORKER_DB_USER: 'sva_job_worker',
    SVA_BOOTSTRAP_ENABLE_HOSTNAME_GUARD: 'false',
    SVA_BOOTSTRAP_ENABLE_INSTANCE_RECONCILE: 'false',
    SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD: 'false',
  });
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`plugin_lifecycle_contract_assertion:${message}`);
}

const waitFor = async (description: string, probe: () => Promise<boolean>): Promise<void> => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`plugin_lifecycle_contract_timeout:${description}`);
};

const scalar = async (pool: QueryClient, sql: string, values: readonly unknown[] = []) => {
  const result = await pool.query<{ value: string }>(sql, values);
  return result.rows[0]?.value;
};

const configureFixture = async (pool: QueryClient): Promise<void> => {
  await pool.query(
    `INSERT INTO iam.instances (
       id, display_name, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id
     )
     VALUES ($1, 'Lifecycle Contract', 'lifecycle-contract.test',
       'lifecycle-contract', 'sva-studio', 'sva-studio-admin')
     ON CONFLICT (id) DO NOTHING`,
    [instanceId]
  );
  await pool.query(
    `INSERT INTO iam.instance_modules (
       instance_id, module_id, activation_policy, activation_origin, effective_active,
       manual_override, manifest_version, policy_revision, state_revision
     ) VALUES ($1, $2, 'automatic', 'policy_reconcile', true, NULL, 1, 'contract-1', 1)
     ON CONFLICT (instance_id, module_id) DO UPDATE SET effective_active = true`,
    [instanceId, pluginId]
  );
  await pool.query(`
    CREATE SCHEMA lifecycle_contract;
    CREATE SEQUENCE lifecycle_contract.failpoint_hits;
    CREATE TABLE lifecycle_contract.control (name text PRIMARY KEY);
    CREATE TABLE lifecycle_contract.effects (
      effect_key text PRIMARY KEY,
      deliveries integer NOT NULL DEFAULT 1
    );
    CREATE FUNCTION lifecycle_contract.trip() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = pg_catalog, lifecycle_contract AS $fn$
    DECLARE configured text; hit bigint;
    BEGIN
      SELECT name INTO configured FROM control LIMIT 1;
      IF configured = TG_ARGV[0]
        AND (TG_NARGS < 2 OR (to_jsonb(NEW) ->> 'key') LIKE TG_ARGV[1]) THEN
        hit := nextval('failpoint_hits');
        IF hit = 1 THEN
          RAISE EXCEPTION 'plugin_lifecycle_failpoint:%', configured;
        END IF;
      END IF;
      RETURN NEW;
    END
    $fn$;
    CREATE TRIGGER lifecycle_contract_after_request
      AFTER INSERT ON iam.instance_plugin_lifecycle
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_request');
    CREATE TRIGGER lifecycle_contract_after_activation_intent
      AFTER INSERT ON iam.instance_plugin_lifecycle
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_activation_intent');
    CREATE TRIGGER lifecycle_contract_after_job
      AFTER INSERT ON iam.studio_jobs
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_job');
    CREATE TRIGGER lifecycle_contract_after_iam_materialization
      AFTER INSERT ON iam.permissions
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_iam_materialization');
    CREATE TRIGGER lifecycle_contract_after_claim
      AFTER UPDATE ON iam.instance_plugin_lifecycle
      FOR EACH ROW WHEN (OLD.active_job_id IS NULL AND NEW.active_job_id IS NOT NULL)
      EXECUTE FUNCTION lifecycle_contract.trip('after_claim');
    CREATE TRIGGER lifecycle_contract_after_lifecycle_terminal
      AFTER UPDATE ON iam.instance_plugin_lifecycle
      FOR EACH ROW WHEN (OLD.active_job_id IS NOT NULL AND NEW.active_job_id IS NULL)
      EXECUTE FUNCTION lifecycle_contract.trip('after_lifecycle_terminal');
    CREATE TRIGGER lifecycle_contract_after_terminal_event
      AFTER INSERT ON iam.studio_job_events
      FOR EACH ROW WHEN (NEW.event_type IN ('job.succeeded', 'job.failed', 'job.cancelled'))
      EXECUTE FUNCTION lifecycle_contract.trip('after_terminal_event');
    CREATE TRIGGER lifecycle_contract_after_terminal_job_status
      AFTER UPDATE ON iam.studio_jobs
      FOR EACH ROW WHEN (
        OLD.status NOT IN ('succeeded', 'failed', 'cancelled')
        AND NEW.status IN ('succeeded', 'failed', 'cancelled')
      ) EXECUTE FUNCTION lifecycle_contract.trip('after_terminal_job_status');
    CREATE TRIGGER lifecycle_contract_after_enqueue
      AFTER INSERT ON graphile_worker._private_jobs
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_enqueue', 'studio-job:%');
    CREATE TRIGGER lifecycle_contract_after_retry_enqueue
      AFTER INSERT ON graphile_worker._private_jobs
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip(
        'after_retry_enqueue', 'plugin-tenant-lifecycle-retry:%'
      );
  `);
};

const setFailpoint = async (pool: QueryClient, name?: string): Promise<void> => {
  await pool.query('TRUNCATE lifecycle_contract.control');
  await pool.query('ALTER SEQUENCE lifecycle_contract.failpoint_hits RESTART WITH 1');
  if (name) await pool.query('INSERT INTO lifecycle_contract.control(name) VALUES ($1)', [name]);
};

const failpointHits = (pool: QueryClient): Promise<string | undefined> =>
  scalar(
    pool,
    "SELECT CASE WHEN is_called THEN last_value::text ELSE '0' END AS value FROM lifecycle_contract.failpoint_hits"
  );

const cleanLifecycle = async (pool: QueryClient): Promise<void> => {
  await setFailpoint(pool);
  await pool.query(
    "DELETE FROM graphile_worker._private_jobs WHERE key LIKE 'studio-job:%' OR key LIKE 'plugin-tenant-lifecycle-%'"
  );
  await pool.query('DELETE FROM iam.instance_plugin_lifecycle WHERE instance_id = $1', [
    instanceId,
  ]);
  await pool.query('DELETE FROM iam.studio_jobs WHERE instance_id = $1', [instanceId]);
};

const cleanActivation = async (pool: QueryClient): Promise<void> => {
  await setFailpoint(pool);
  await pool.query(
    "DELETE FROM graphile_worker._private_jobs WHERE key LIKE 'plugin-tenant-lifecycle-activation:%'"
  );
  await pool.query(
    'DELETE FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2',
    [instanceId, activationPluginId]
  );
  await pool.query('DELETE FROM iam.permissions WHERE instance_id = $1 AND permission_key = $2', [
    instanceId,
    `${activationPluginId}.read`,
  ]);
  await pool.query('DELETE FROM iam.instance_modules WHERE instance_id = $1 AND module_id = $2', [
    instanceId,
    activationPluginId,
  ]);
};

const configureObservabilityFixture = async (pool: QueryClient): Promise<void> => {
  const oldTimestamp = new Date(Date.now() - 180_000).toISOString();
  const dueTimestamp = new Date(Date.now() - 60_000).toISOString();
  const futureTimestamp = new Date(Date.now() + 600_000).toISOString();
  const staleJobId = randomUUID();
  const queuedJobId = randomUUID();
  const freshQueuedJobId = randomUUID();

  await pool.query(
    `INSERT INTO iam.instances (
       id, display_name, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id
     ) VALUES ($1, 'Lifecycle Observability', 'lifecycle-observability.test',
       'lifecycle-observability', 'sva-studio', 'sva-studio-admin')
     ON CONFLICT (id) DO NOTHING`,
    [observabilityOtherInstanceId]
  );
  await pool.query('DELETE FROM iam.instance_plugin_lifecycle WHERE instance_id IN ($1, $2)', [
    instanceId,
    observabilityOtherInstanceId,
  ]);
  await pool.query('DELETE FROM iam.studio_jobs WHERE instance_id IN ($1, $2)', [
    instanceId,
    observabilityOtherInstanceId,
  ]);
  await pool.query(
    `INSERT INTO iam.studio_jobs (
       id, instance_id, plugin_id, job_type_id, queue_name, status, input_payload,
       attempts, max_attempts, idempotency_key, scheduled_at, started_at, updated_at,
       worker_id, heartbeat_at, source
     ) VALUES
       ($1, $4, 'obs-stale', 'obs-stale.provision', 'plugin-lifecycle', 'running', '{}'::jsonb,
        1, 5, 'obs-stale', $6, $6, $6, 'lost-worker', $6, 'plugin'),
       ($2, $5, 'obs-queued', 'obs-queued.provision', 'plugin-lifecycle', 'queued', '{}'::jsonb,
        0, 5, 'obs-queued', $6, NULL, $6, NULL, NULL, 'plugin'),
       ($3, $4, 'obs-fresh', 'obs-fresh.provision', 'plugin-lifecycle', 'queued', '{}'::jsonb,
        0, 5, 'obs-fresh', $7, NULL, $7, NULL, NULL, 'plugin')`,
    [
      staleJobId,
      queuedJobId,
      freshQueuedJobId,
      instanceId,
      observabilityOtherInstanceId,
      oldTimestamp,
      dueTimestamp,
    ]
  );
  await pool.query(
    `INSERT INTO iam.instance_plugin_lifecycle (
       instance_id, plugin_id, readiness_status, desired_generation, completed_generation,
       claimed_generation, active_job_id, retry_kind, retry_after, started_at, updated_at,
       next_recheck_at
     ) VALUES
       ($1, 'obs-stale', 'pending', 1, 0, 1, $3, NULL, NULL, $6, $6, $8),
       ($2, 'obs-queued', 'pending', 1, 0, 1, $4, NULL, NULL, NULL, $6, $8),
       ($1, 'obs-fresh', 'pending', 1, 0, 1, $5, NULL, NULL, NULL, $7, $8),
       ($1, 'obs-retry', 'degraded', 2, 1, NULL, NULL, 'retryable', $7, NULL, $7, NULL),
       ($2, 'obs-recheck', 'pending', 1, 1, NULL, NULL, NULL, NULL, NULL, $7, $7),
       ($1, 'obs-owner', 'blocked', 2, 1, NULL, NULL, 'terminal', NULL, NULL, $7, NULL),
       ($1, 'obs-wait-retry', 'degraded', 2, 1, NULL, NULL, 'retryable', $8, NULL, $7, NULL),
       ($2, 'obs-wait-recheck', 'pending', 2, 1, NULL, NULL, NULL, NULL, NULL, $7, $8)`,
    [
      instanceId,
      observabilityOtherInstanceId,
      staleJobId,
      queuedJobId,
      freshQueuedJobId,
      oldTimestamp,
      dueTimestamp,
      futureTimestamp,
    ]
  );
};

const reconcileActivationAndIam = async (pool: ContractPool): Promise<void> => {
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

const transitionJobForRecovery = async (
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

const persistLifecycleFailureEvidence = async (
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

type RuntimeModules = {
  readonly start: (input: {
    instanceId: string;
    pluginId: string;
    operation: 'provision' | 'reconcile';
    scheduledAt: string;
  }) => Promise<{ lifecycle: { desiredGeneration: number }; job: { id: string } }>;
  readonly ensure: (instanceId: string) => Promise<void>;
  readonly createTaskList: (
    getRegistry: () => ReadonlyMap<string, unknown>,
    taskIdentifier?: string
  ) => Record<string, (payload: unknown, helpers: unknown) => Promise<void>>;
  readonly registry: () => ReadonlyMap<string, unknown>;
  readonly configure: (input: {
    activationPolicies: {
      revision: string;
      modules: readonly {
        moduleId: string;
        activationPolicy: 'automatic';
        manifestVersion: number;
        policyRevision: string;
      }[];
    };
    moduleIamContracts: readonly [];
    tenantLifecycles: readonly {
      pluginId: string;
      contractVersion: 1;
      operations: readonly {
        operation: 'provision' | 'reconcile';
        jobTypeId: string;
      }[];
      readinessChecks: readonly {
        checkId: string;
        titleKey: string;
        required: boolean;
      }[];
    }[];
  }) => void;
  readonly register: (handlers: Readonly<Record<string, unknown>>) => void;
  readonly close: () => Promise<void>;
};

const loadRuntime = async (port: string): Promise<RuntimeModules> => {
  process.env.IAM_DATABASE_URL = `postgres://postgres:${adminPassword}@127.0.0.1:${port}/${database}`;
  process.env.STUDIO_JOB_WORKER_DATABASE_URL = `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`;
  const [runtime, runner, snapshot, databaseRuntime, jobRepository, registryRepository] =
    await Promise.all([
      import('../../packages/auth-runtime/src/plugin-tenant-lifecycle/runtime.js'),
      import('../../packages/auth-runtime/src/plugin-operations/runner-registry.js'),
      import('../../packages/auth-runtime/src/iam-instance-registry/plugin-activation-policy-snapshot.js'),
      import('../../packages/auth-runtime/src/db.js'),
      import('../../packages/auth-runtime/src/plugin-operations/repository.js'),
      import('../../packages/auth-runtime/src/iam-instance-registry/repository.js'),
    ]);
  return {
    start: runtime.startConfiguredPluginTenantLifecycle,
    ensure: runtime.ensureConfiguredPluginTenantProvisioning,
    createTaskList: runner.createStudioJobTaskList as RuntimeModules['createTaskList'],
    registry: runner.getRegisteredStudioJobExecutionRegistry as RuntimeModules['registry'],
    configure: snapshot.configureInstanceRegistryPluginRuntimeSnapshot,
    register: runner.registerPluginOperationExecutionHandlers as RuntimeModules['register'],
    close: async () => {
      await Promise.all([
        databaseRuntime.resolvePool()?.end(),
        jobRepository.closeStudioJobRepositoryPoolForShutdown(),
        registryRepository.closeInstanceRegistryRepositoryPoolForShutdown(),
      ]);
    },
  };
};

const configureRuntime = (
  runtime: RuntimeModules,
  contractRevision: 'contract-1' | 'contract-2' = 'contract-1',
  behavior:
    | 'ready'
    | 'pending'
    | 'invalid'
    | 'malformed'
    | 'retry-once'
    | 'always-fail'
    | 'idempotent-effect' = 'ready',
  executionLane: 'default' | 'privileged' = 'default'
): void => {
  handlerAttempts = 0;
  runtime.configure({
    activationPolicies: {
      revision: contractRevision,
      modules: [
        {
          moduleId: pluginId,
          activationPolicy: 'automatic',
          manifestVersion: contractRevision === 'contract-1' ? 1 : 2,
          policyRevision: contractRevision,
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
        readinessChecks: [
          { checkId: `${pluginId}.database`, titleKey: 'contract', required: true },
        ],
      },
    ],
  });
  runtime.register({
    [jobTypeId]: {
      queueName,
      executionLane,
      handler: async () => {
        handlerAttempts += 1;
        if (behavior === 'invalid') return {};
        if (behavior === 'malformed') {
          return { tenantLifecycle: { revision: '', checks: [] } };
        }
        if (behavior === 'idempotent-effect') {
          assert(handlerEffectDatabase, 'handler_effect_database_missing');
          await handlerEffectDatabase.query(
            `INSERT INTO lifecycle_contract.effects(effect_key) VALUES ($1)
             ON CONFLICT (effect_key) DO UPDATE
             SET deliveries = lifecycle_contract.effects.deliveries + 1`,
            [`${instanceId}:${pluginId}`]
          );
        }
        if (behavior === 'always-fail' || (behavior === 'retry-once' && handlerAttempts === 1)) {
          throw new Error(`lifecycle-contract-${behavior}`);
        }
        return {
          tenantLifecycle: {
            revision: 'database-1',
            checks: [
              {
                checkId: `${pluginId}.database`,
                status: behavior === 'pending' ? 'pending' : 'ready',
              },
            ],
          },
        };
      },
    },
  });
};

const startLifecycle = (
  runtime: RuntimeModules,
  operation: 'provision' | 'reconcile' = 'provision',
  scheduledAt = new Date().toISOString()
) => runtime.start({ instanceId, pluginId, operation, scheduledAt });

type ContractWorkerProcess = {
  readonly child: ReturnType<typeof spawn>;
  readonly output: { stderr: string; stdout: string };
};

const spawnContractWorker = (
  port: string,
  jobId: string,
  mode: 'hold' | 'run' | 'shutdown'
): ContractWorkerProcess => {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'tooling/testing/fixtures/plugin-lifecycle-worker-process.ts'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        IAM_DATABASE_URL: `postgres://postgres:${adminPassword}@127.0.0.1:${port}/${database}`,
        STUDIO_JOB_WORKER_DATABASE_URL: `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`,
        SVA_LIFECYCLE_CONTRACT_JOB_ID: jobId,
        SVA_LIFECYCLE_CONTRACT_WORKER_MODE: mode,
        SVA_PLUGIN_OPERATION_WORKER_ENABLED: 'true',
        SVA_PLUGIN_OPERATION_WORKER_LANE: 'privileged',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const output = { stderr: '', stdout: '' };
  contractWorkerProcesses.add(child);
  child.once('exit', () => contractWorkerProcesses.delete(child));
  child.stdout?.on('data', (chunk: Buffer) => {
    output.stdout += chunk.toString('utf8');
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output.stderr += chunk.toString('utf8');
  });
  return { child, output };
};

const waitForWorkerOutput = async (
  workerProcess: ContractWorkerProcess,
  marker: string
): Promise<void> =>
  waitFor(`worker-process:${marker}`, async () => {
    if (workerProcess.output.stdout.includes(marker)) return true;
    if (workerProcess.child.exitCode !== null) {
      throw new Error(
        `plugin_lifecycle_worker_process_early_exit:${workerProcess.child.exitCode}:${workerProcess.output.stderr}`
      );
    }
    return false;
  });

const waitForWorkerExit = async (
  workerProcess: ContractWorkerProcess
): Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }> => {
  if (workerProcess.child.exitCode !== null || workerProcess.child.signalCode !== null) {
    return {
      code: workerProcess.child.exitCode,
      signal: workerProcess.child.signalCode,
    };
  }
  return new Promise((resolve, reject) => {
    workerProcess.child.once('error', reject);
    workerProcess.child.once('exit', (code, signal) => resolve({ code, signal }));
  });
};

const runWorkerUntil = async (
  runtime: RuntimeModules,
  workerPool: ContractPool,
  probe: () => Promise<boolean>
): Promise<void> => {
  const runner = runTaskList(
    { concurrency: 1, noHandleSignals: true },
    runtime.createTaskList(runtime.registry),
    workerPool
  );
  try {
    await waitFor('worker-result', probe);
  } finally {
    await runner.gracefulShutdown();
  }
};

const runWorkerAcrossExplicitRestart = async (
  runtime: RuntimeModules,
  workerPool: ContractPool,
  firstAttemptPersisted: () => Promise<boolean>,
  completed: () => Promise<boolean>
): Promise<void> => {
  const firstRunner = runTaskList(
    { concurrency: 1, noHandleSignals: true },
    runtime.createTaskList(runtime.registry),
    workerPool
  );
  await waitFor('first-worker-attempt', firstAttemptPersisted);
  await firstRunner.gracefulShutdown();
  await runWorkerUntil(runtime, workerPool, completed);
};

const reportCase = async (name: string, work: () => Promise<void>): Promise<void> => {
  const startedAt = Date.now();
  await work();
  process.stdout.write(`LIFECYCLE-CONTRACT CASE ${name} PASS ${Date.now() - startedAt}ms\n`);
};

const assertPersistedTerminalOutcome = async (
  pool: QueryClient,
  input: {
    readonly jobId: string;
    readonly generation: number;
    readonly status: 'succeeded' | 'failed';
    readonly eventType: 'job.succeeded' | 'job.failed';
    readonly executionKey?: string;
  }
): Promise<void> => {
  assert(
    (await scalar(pool, 'SELECT (status = $2)::text AS value FROM iam.studio_jobs WHERE id = $1', [
      input.jobId,
      input.status,
    ])) === 'true',
    `persisted_terminal_job_status:${input.jobId}`
  );
  assert(
    (await scalar(
      pool,
      `SELECT (
         count(*) = 1
         AND count(*) FILTER (WHERE event_type = $2) = 1
       )::text AS value
       FROM iam.studio_job_events
       WHERE job_id = $1
         AND event_type IN ('job.succeeded', 'job.failed', 'job.cancelled')`,
      [input.jobId, input.eventType]
    )) === 'true',
    `persisted_single_terminal_event:${input.jobId}`
  );
  const generationPredicate =
    input.status === 'succeeded'
      ? 'completed_generation = $3'
      : 'completed_generation < $3 AND claimed_generation IS NULL';
  assert(
    (await scalar(
      pool,
      `SELECT (
         active_job_id IS NULL
         AND desired_generation = $3
         AND ${generationPredicate}
       )::text AS value
       FROM iam.instance_plugin_lifecycle
       WHERE instance_id = $1 AND plugin_id = $2`,
      [instanceId, pluginId, input.generation]
    )) === 'true',
    `persisted_terminal_lifecycle_fence:${input.jobId}`
  );
  assert(
    (await scalar(
      pool,
      `SELECT count(*)::text AS value
       FROM graphile_worker.jobs
       WHERE key = $1${input.status === 'failed' ? ' AND attempts < max_attempts' : ''}`,
      [input.executionKey ?? `studio-job:${input.jobId}`]
    )) === '0',
    `persisted_execution_key_not_executable:${input.jobId}`
  );
};

const assertPersistedPendingRetry = async (
  pool: QueryClient,
  input: { readonly jobId: string; readonly generation: number }
): Promise<void> => {
  await assertPersistedTerminalOutcome(pool, {
    jobId: input.jobId,
    generation: input.generation,
    status: 'succeeded',
    eventType: 'job.succeeded',
  });
  assert(
    (await scalar(
      pool,
      `SELECT (
         readiness_status = 'pending'
         AND retry_kind IS NULL
         AND next_recheck_at IS NOT NULL
       )::text AS value
       FROM iam.instance_plugin_lifecycle
       WHERE instance_id = $1 AND plugin_id = $2`,
      [instanceId, pluginId]
    )) === 'true',
    `persisted_pending_retry_lifecycle:${input.jobId}`
  );
  assert(
    (await scalar(pool, 'SELECT count(*)::text AS value FROM graphile_worker.jobs WHERE key = $1', [
      `plugin-tenant-lifecycle-retry:${instanceId}:${pluginId}`,
    ])) === '1',
    `persisted_single_retry_key:${input.jobId}`
  );
};

const runMatrix = async (
  adminPool: ContractPool,
  workerPool: ContractPool,
  runtime: RuntimeModules,
  port: string
): Promise<void> => {
  handlerEffectDatabase = adminPool;
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
    assert(handlerAttempts === 2, 'retrying_redelivery_attempts');
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

  await reportCase('OBS-01-positive-aggregated-snapshot-through-app-role', async () => {
    await configureObservabilityFixture(adminPool);
    const appPool = new Pool({
      connectionString: `postgres://sva_app:${appPassword}@127.0.0.1:${port}/${database}`,
      max: 1,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      await client.query('SELECT set_config($1, $2, true)', ['app.instance_id', instanceId]);
      const directTenantRows = await scalar(
        client,
        'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle'
      );
      const directForeignRows = await scalar(
        client,
        'SELECT count(*)::text AS value FROM iam.instance_plugin_lifecycle WHERE instance_id = $1',
        [observabilityOtherInstanceId]
      );
      const snapshot = await client.query<{ reason_code: string; stall_count: string }>(
        'SELECT reason_code, stall_count::text FROM iam.plugin_tenant_lifecycle_observability_snapshot() ORDER BY reason_code'
      );
      await client.query('COMMIT');

      assert(directTenantRows === '5', 'obs01_direct_current_tenant_only');
      assert(directForeignRows === '0', 'obs01_direct_foreign_tenant_hidden');
      assert(snapshot.rows.length === 5, 'obs01_exact_bounded_rows');
      const counts = new Map(snapshot.rows.map((row) => [row.reason_code, row.stall_count]));
      assert(counts.get('stale_claim') === '1', 'obs01_stale_claim');
      assert(counts.get('queued_due') === '1', 'obs01_queued_due_across_tenants');
      assert(counts.get('retry_due') === '1', 'obs01_retry_due');
      assert(counts.get('pending_recheck_due') === '1', 'obs01_pending_recheck_due');
      assert(counts.get('generation_without_owner') === '2', 'obs01_generation_without_owner');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release?.();
      await appPool.end();
    }

    assert(
      (await scalar(
        adminPool,
        `SELECT (
           NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
           AND NOT EXISTS (
             SELECT 1
             FROM pg_auth_members
             WHERE roleid = pg_roles.oid
           )
         )::text AS value
         FROM pg_roles
         WHERE rolname = 'iam_observability'`
      )) === 'true',
      'obs01_definer_role_hardened'
    );
    assert(
      (await scalar(
        adminPool,
        `SELECT (
           has_any_column_privilege('iam_observability', 'iam.instance_plugin_lifecycle', 'SELECT')
           AND has_any_column_privilege('iam_observability', 'iam.studio_jobs', 'SELECT')
           AND ARRAY(
             SELECT column_name::text
             FROM information_schema.column_privileges
             WHERE grantee = 'iam_observability'
               AND table_schema = 'iam'
               AND table_name = 'instance_plugin_lifecycle'
               AND privilege_type = 'SELECT'
             ORDER BY column_name
           ) = ARRAY[
             'active_job_id', 'completed_generation', 'desired_generation',
             'next_recheck_at', 'readiness_status', 'retry_after', 'retry_kind',
             'started_at', 'updated_at'
           ]
           AND ARRAY(
             SELECT column_name::text
             FROM information_schema.column_privileges
             WHERE grantee = 'iam_observability'
               AND table_schema = 'iam'
               AND table_name = 'studio_jobs'
               AND privilege_type = 'SELECT'
             ORDER BY column_name
           ) = ARRAY['heartbeat_at', 'id', 'scheduled_at', 'started_at', 'status']
           AND NOT has_table_privilege('iam_observability', 'iam.instance_plugin_lifecycle', 'INSERT,UPDATE,DELETE')
           AND NOT has_table_privilege('iam_observability', 'iam.studio_jobs', 'INSERT,UPDATE,DELETE')
           AND NOT has_schema_privilege('iam_observability', 'iam', 'CREATE')
         )::text AS value`
      )) === 'true',
      'obs01_definer_read_only'
    );
    assert(
      (await scalar(
        adminPool,
        `SELECT (
           count(*) = 2
           AND bool_and(cmd = 'SELECT')
           AND bool_and(roles = ARRAY['iam_observability']::name[])
         )::text AS value
         FROM pg_policies
         WHERE schemaname = 'iam'
           AND policyname IN (
             'instance_plugin_lifecycle_observability_policy',
             'studio_jobs_observability_policy'
           )`
      )) === 'true',
      'obs01_select_policies_are_role_specific'
    );
  });

  await reportCase('OBS-01-negative-no-raw-or-public-observability-access', async () => {
    assert(
      (await scalar(
        adminPool,
        `SELECT (count(*) = 0)::text AS value
         FROM pg_proc procedure
         JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
         CROSS JOIN LATERAL aclexplode(
           coalesce(procedure.proacl, acldefault('f', procedure.proowner))
         ) privilege
         WHERE namespace.nspname = 'iam'
           AND procedure.proname = 'plugin_tenant_lifecycle_observability_snapshot'
           AND privilege.grantee = 0
           AND privilege.privilege_type = 'EXECUTE'`
      )) === 'true',
      'obs01_public_execute_revoked'
    );
    assert(
      (await scalar(
        adminPool,
        `SELECT (
           pg_get_userbyid(proowner) = 'iam_observability'
           AND proretset
           AND proargtypes = ''::oidvector
         )::text AS value
         FROM pg_proc procedure
         JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
         WHERE namespace.nspname = 'iam'
           AND procedure.proname = 'plugin_tenant_lifecycle_observability_snapshot'`
      )) === 'true',
      'obs01_parameterless_owned_function'
    );

    const appPool = new Pool({
      connectionString: `postgres://sva_app:${appPassword}@127.0.0.1:${port}/${database}`,
      max: 1,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      let setRoleDenied = false;
      await client.query('SAVEPOINT observability_role_probe');
      try {
        await client.query('SET LOCAL ROLE iam_observability');
      } catch {
        setRoleDenied = true;
        await client.query('ROLLBACK TO SAVEPOINT observability_role_probe');
      }
      await client.query('ROLLBACK');
      assert(setRoleDenied, 'obs01_app_cannot_assume_definer_role');
    } finally {
      client.release?.();
      await appPool.end();
    }
  });

  await reportCase('OBS-01-positive-migration-down-up-cleanup', async () => {
    const observabilityRoleOid = await scalar(
      adminPool,
      "SELECT oid::text AS value FROM pg_roles WHERE rolname = 'iam_observability'"
    );
    assert(observabilityRoleOid, 'obs01_definer_role_oid_available_before_down');

    try {
      run(
        'bash',
        ['packages/data/scripts/run-migrations.sh', 'down-to', '90'],
        migrationEnvironment(port)
      );
      assert(
        (await scalar(
          adminPool,
          "SELECT (to_regprocedure('iam.plugin_tenant_lifecycle_observability_snapshot()') IS NULL)::text AS value"
        )) === 'true',
        'obs01_down_removes_function'
      );
      assert(
        (await scalar(
          adminPool,
          "SELECT (NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_observability'))::text AS value"
        )) === 'true',
        'obs01_down_removes_definer_role'
      );
      assert(
        (await scalar(
          adminPool,
          `SELECT (count(*) = 0)::text AS value
           FROM pg_policies
           WHERE schemaname = 'iam'
             AND policyname IN (
               'instance_plugin_lifecycle_observability_policy',
               'studio_jobs_observability_policy'
             )`
        )) === 'true',
        'obs01_down_removes_select_policies'
      );
      assert(
        (await scalar(
          adminPool,
          `SELECT (count(*) = 0)::text AS value
           FROM pg_attribute AS attribute
           JOIN pg_class AS relation ON relation.oid = attribute.attrelid
           JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           CROSS JOIN LATERAL aclexplode(attribute.attacl) AS privilege
           WHERE namespace.nspname = 'iam'
             AND relation.relname IN ('instance_plugin_lifecycle', 'studio_jobs')
             AND privilege.grantee = $1::oid`,
          [observabilityRoleOid]
        )) === 'true',
        'obs01_down_removes_column_acl'
      );
      await adminPool.query('CREATE ROLE iam_observability NOLOGIN NOSUPERUSER NOBYPASSRLS');
      let conflictingRoleRejected = false;
      try {
        run(
          'bash',
          ['packages/data/scripts/run-migrations.sh', 'up-to', '91'],
          migrationEnvironment(port)
        );
      } catch {
        conflictingRoleRejected = true;
      }
      assert(conflictingRoleRejected, 'obs01_up_rejects_preexisting_definer_role');
      assert(
        (await scalar(
          adminPool,
          'SELECT (max(version_id) = 90)::text AS value FROM public.goose_db_version WHERE is_applied'
        )) === 'true',
        'obs01_role_conflict_rolls_back_migration'
      );
    } finally {
      run(
        'bash',
        ['packages/data/scripts/run-migrations.sh', 'down-to', '90'],
        migrationEnvironment(port)
      );
      await adminPool.query('DROP ROLE IF EXISTS iam_observability');
      run(
        'bash',
        ['packages/data/scripts/run-migrations.sh', 'up-to', '91'],
        migrationEnvironment(port)
      );
    }

    assert(
      (await scalar(
        adminPool,
        `SELECT (
           to_regprocedure('iam.plugin_tenant_lifecycle_observability_snapshot()') IS NOT NULL
           AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_observability')
           AND NOT EXISTS (
             SELECT 1
             FROM pg_auth_members
             WHERE roleid = (SELECT oid FROM pg_roles WHERE rolname = 'iam_observability')
           )
           AND (
             SELECT count(*) = 2
             FROM pg_policies
             WHERE schemaname = 'iam'
               AND policyname IN (
                 'instance_plugin_lifecycle_observability_policy',
                 'studio_jobs_observability_policy'
               )
           )
         )::text AS value`
      )) === 'true',
      'obs01_up_reinstalls_function_role_and_policies'
    );
  });
};

const main = async (): Promise<void> => {
  let adminPool: ContractPool | undefined;
  let workerPool: ContractPool | undefined;
  let runtime: RuntimeModules | undefined;
  const startedAt = Date.now();
  try {
    const port = startDatabase();
    migrateDatabase(port);
    adminPool = new Pool({
      connectionString: `postgres://postgres:${adminPassword}@127.0.0.1:${port}/${database}`,
      max: 4,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    workerPool = new Pool({
      connectionString: `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`,
      max: 2,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    await configureFixture(adminPool);
    runtime = await loadRuntime(port);
    await runMatrix(adminPool, workerPool, runtime, port);
    process.stdout.write(
      `Plugin lifecycle database contract passed in ${Date.now() - startedAt}ms\n`
    );
  } finally {
    for (const child of contractWorkerProcesses) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    await runtime?.close();
    await workerPool?.end();
    await adminPool?.end();
    spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
  }
};

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
