import { execFileSync, spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const containerName = `sva-graphile-contract-${process.pid}`;
const adminPassword = 'contract-admin-password';
const appPassword = 'contract-app-password';
const workerPassword = 'contract-worker-password';
const publicProbePassword = 'contract-public-probe-password';
const database = 'sva_studio';
const requireFromAuthRuntime = createRequire(
  realpathSync(resolve('apps/sva-studio-react/node_modules/@sva/auth-runtime/package.json'))
);
interface ContractPool {
  end(): Promise<void>;
}
interface ContractRunner {
  gracefulShutdown(): Promise<void>;
}
const { Pool } = requireFromAuthRuntime('pg') as {
  Pool: new (options: { connectionString: string; max: number }) => ContractPool;
};
const { runTaskList } = requireFromAuthRuntime('graphile-worker') as {
  runTaskList(
    options: { concurrency: number; noHandleSignals: boolean },
    taskList: Record<string, () => Promise<void>>,
    pool: ContractPool
  ): ContractRunner;
};

const run = (command: string, args: string[], env?: NodeJS.ProcessEnv): string =>
  execFileSync(command, args, {
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const waitForPostgres = (port: string): void => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = spawnSync(
      'pg_isready',
      ['--host', '127.0.0.1', '--port', port, '--username', 'postgres', '--dbname', database],
      { env: { ...process.env, PGPASSWORD: adminPassword }, stdio: 'ignore' }
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error('graphile_contract_postgres_not_ready');
};

const psql = (user: string, password: string, port: string, sql: string): string =>
  run(
    'psql',
    [
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--username',
      user,
      '--dbname',
      database,
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    { PGPASSWORD: password }
  );

const psqlStatus = (user: string, password: string, port: string, sql: string): number | null =>
  spawnSync(
    'psql',
    [
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--username',
      user,
      '--dbname',
      database,
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    { env: { ...process.env, PGPASSWORD: password }, stdio: 'ignore' }
  ).status;

const startContractDatabase = (): string => {
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
  if (!port) throw new Error('graphile_contract_postgres_port_missing');
  waitForPostgres(port);
  return port;
};

const migrateAndBootstrap = (port: string): void => {
  psql(
    'postgres',
    adminPassword,
    port,
    `CREATE ROLE iam_app NOLOGIN;
     CREATE ROLE contract_public_probe LOGIN PASSWORD '${publicProbePassword}';
     CREATE SCHEMA iam;`
  );
  run('node', ['deploy/portainer/migrate-graphile-worker.mjs'], {
    POSTGRES_DB: database,
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PASSWORD: adminPassword,
    POSTGRES_PORT: port,
    POSTGRES_USER: 'postgres',
  });
  if (
    psqlStatus(
      'contract_public_probe',
      publicProbePassword,
      port,
      "SELECT graphile_worker.add_job('studio_job_execute', '{}'::json);"
    ) === 0
  ) {
    throw new Error('graphile_contract_public_enqueue_was_allowed_after_migration');
  }
  run('bash', ['deploy/portainer/bootstrap-entrypoint.sh'], {
    APP_DB_PASSWORD: appPassword,
    APP_DB_USER: 'sva_app',
    POSTGRES_DB: database,
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PASSWORD: adminPassword,
    POSTGRES_PORT: port,
    POSTGRES_USER: 'postgres',
    STUDIO_JOB_WORKER_DB_PASSWORD: workerPassword,
    STUDIO_JOB_WORKER_DB_USER: 'sva_job_worker',
    SVA_BOOTSTRAP_ENABLE_HOSTNAME_GUARD: 'false',
    SVA_BOOTSTRAP_ENABLE_INSTANCE_RECONCILE: 'false',
    SVA_BOOTSTRAP_ENABLE_SCHEMA_GUARD: 'false',
  });
};

const enqueueContractJob = (port: string): void => {
  psql(
    'sva_app',
    appPassword,
    port,
    `SELECT graphile_worker.sva_enqueue_job(
      'studio_job_execute',
      '{"instanceId":"contract","jobId":"contract-job"}'::json,
      'plugin-operations',
      5,
      'studio-job:contract-job'
    );`
  );
  const queuedCount = psql(
    'sva_job_worker',
    workerPassword,
    port,
    "SELECT count(*) FROM graphile_worker.jobs WHERE key = 'studio-job:contract-job';"
  );
  if (queuedCount !== '1') throw new Error(`graphile_contract_job_not_visible:${queuedCount}`);
};

const processContractJob = async (
  port: string
): Promise<{ pool: ContractPool; runner: ContractRunner }> => {
  const pool = new Pool({
    connectionString: `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`,
    max: 2,
  });
  let resolveHandled: (() => void) | undefined;
  const handled = new Promise<void>((resolveHandledPromise) => {
    resolveHandled = resolveHandledPromise;
  });
  const runner = runTaskList(
    { concurrency: 1, noHandleSignals: true },
    { studio_job_execute: async () => resolveHandled?.() },
    pool
  );
  try {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        handled,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('graphile_contract_worker_timeout')), 10_000);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const remainingJobs = psql(
        'sva_job_worker',
        workerPassword,
        port,
        "SELECT count(*) FROM graphile_worker.jobs WHERE key = 'studio-job:contract-job';"
      );
      if (remainingJobs === '0') return { pool, runner };
      if (attempt === 39) throw new Error('graphile_contract_job_not_completed');
      await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 125));
    }
    throw new Error('graphile_contract_job_not_completed');
  } catch (error) {
    await runner.gracefulShutdown();
    await pool.end();
    throw error;
  }
};

const assertAppRestrictions = (port: string): void => {
  if (
    psqlStatus(
      'sva_app',
      appPassword,
      port,
      "SELECT graphile_worker.add_job('studio_job_execute', '{}'::json);"
    ) === 0
  ) {
    throw new Error('graphile_contract_upstream_enqueue_was_allowed');
  }
  if (
    psqlStatus(
      'sva_app',
      appPassword,
      port,
      'SELECT count(*) FROM graphile_worker._private_jobs;'
    ) === 0
  ) {
    throw new Error('graphile_contract_internal_table_read_was_allowed');
  }
};

const main = async (): Promise<void> => {
  let runner: ContractRunner | undefined;
  let workerPool: ContractPool | undefined;
  try {
    const port = startContractDatabase();
    migrateAndBootstrap(port);
    enqueueContractJob(port);
    ({ pool: workerPool, runner } = await processContractJob(port));
    assertAppRestrictions(port);

    process.stdout.write('Graphile worker database contract passed\n');
  } finally {
    if (runner) await runner.gracefulShutdown();
    if (workerPool) await workerPool.end();
    spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
  }
};

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
