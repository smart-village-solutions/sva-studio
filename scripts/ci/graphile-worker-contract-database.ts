import { execFileSync, spawnSync } from 'node:child_process';

export const containerName = `sva-graphile-contract-${process.pid}`;
export const adminPassword = 'contract-admin-password';
export const appPassword = 'contract-app-password';
export const workerPassword = 'contract-worker-password';
const publicProbePassword = 'contract-public-probe-password';
export const database = 'sva_studio';
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

export const psql = (user: string, password: string, port: string, sql: string): string =>
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

export const psqlStatus = (
  user: string,
  password: string,
  port: string,
  sql: string
): number | null =>
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

export const executeAsEffectiveApp = (port: string, sql: string): string =>
  psql(
    'postgres',
    adminPassword,
    port,
    `BEGIN;
     SET LOCAL ROLE iam_app;
     ${sql}
     COMMIT;`
  );

export const startContractDatabase = (): string => {
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

export const migrateGraphileWorker = (port: string): void => {
  psql(
    'postgres',
    adminPassword,
    port,
    `CREATE ROLE iam_app NOLOGIN;
     CREATE ROLE contract_public_probe LOGIN PASSWORD '${publicProbePassword}';
     CREATE SCHEMA iam;
     CREATE TABLE public.goose_db_version (version_id bigint NOT NULL, is_applied boolean NOT NULL);`
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
};

export const seedLegacyAppMembership = (port: string): void => {
  psql(
    'postgres',
    adminPassword,
    port,
    `CREATE ROLE sva_app LOGIN PASSWORD '${appPassword}' INHERIT;
     GRANT iam_app TO sva_app WITH INHERIT TRUE;`
  );
};

export const bootstrapWorkerRole = (port: string): void => {
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
