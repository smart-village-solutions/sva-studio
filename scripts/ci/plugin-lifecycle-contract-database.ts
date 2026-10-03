import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import {
  adminPassword,
  appPassword,
  containerName,
  database,
  rootDir,
  workerPassword,
} from './plugin-lifecycle-contract-base.js';

import type { ContractPool, ContractRunner } from './plugin-lifecycle-contract-base.js';

const requireFromAuthRuntime = createRequire(
  createRequire(import.meta.url).resolve('@sva/auth-runtime')
);

export const { Pool } = requireFromAuthRuntime('pg') as {
  Pool: new (options: {
    connectionString: string;
    max: number;
    idleTimeoutMillis: number;
    statement_timeout: number;
    idle_in_transaction_session_timeout: number;
  }) => ContractPool;
};
export const { runTaskList } = requireFromAuthRuntime('graphile-worker') as {
  runTaskList(
    options: { concurrency: number; noHandleSignals: boolean },
    taskList: Record<string, (payload: unknown, helpers: unknown) => Promise<void>>,
    pool: ContractPool
  ): ContractRunner;
};

export const run = (command: string, args: readonly string[], env = process.env): string =>
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

export const startDatabase = (): string => {
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

export const migrationEnvironment = (port: string): NodeJS.ProcessEnv => ({
  ...process.env,
  POSTGRES_DB: database,
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PASSWORD: adminPassword,
  POSTGRES_PORT: port,
  POSTGRES_USER: 'postgres',
  SVA_LOCAL_POSTGRES_CONTAINER_NAME: containerName,
});

export const migrateDatabase = (port: string): void => {
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
