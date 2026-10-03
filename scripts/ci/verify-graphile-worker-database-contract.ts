import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  adminPassword,
  appPassword,
  bootstrapWorkerRole,
  containerName,
  database,
  executeAsEffectiveApp,
  migrateGraphileWorker,
  psql,
  psqlStatus,
  seedLegacyAppMembership,
  startContractDatabase,
  workerPassword,
} from './graphile-worker-contract-database.js';
import { enqueueContractJobs } from './graphile-worker-contract-jobs.js';

const workspaceRequire = createRequire(import.meta.url);
const requireFromAuthRuntime = createRequire(workspaceRequire.resolve('@sva/auth-runtime'));

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

const runWorkerReadiness = async (
  port: string,
  appDbUser: string,
  workerDbUser: string,
  connection: { readonly password: string; readonly user: string } = {
    password: adminPassword,
    user: 'postgres',
  }
) => {
  const schemaGuardModule = (await import(
    pathToFileURL(resolve('packages/auth-runtime/dist/iam-account-management/schema-guard.js')).href
  )) as typeof import('../../packages/auth-runtime/src/iam-account-management/schema-guard.js');
  return schemaGuardModule.runGraphileWorkerReadinessForConnection(
    {
      database,
      host: '127.0.0.1',
      password: connection.password,
      port: Number.parseInt(port, 10),
      user: connection.user,
    },
    'iam_app',
    appDbUser,
    workerDbUser
  );
};

const assertMissingWorkerRoleReadiness = async (port: string): Promise<void> => {
  const report = await runWorkerReadiness(port, 'postgres', 'missing_worker_role');
  const expectedFailures =
    'worker_role_exists,worker_can_process,worker_functions_complete,worker_sequences_complete,worker_policies_complete'.split(
      ','
    );
  if (report.ok || expectedFailures.some((check) => !report.failedChecks.includes(check))) {
    throw new Error(
      `graphile_contract_missing_worker_role_not_reported:${report.failedChecks.join(',')}`
    );
  }
};

const assertCanonicalWorkerReadiness = async (port: string): Promise<void> => {
  const report = await runWorkerReadiness(port, 'sva_app', 'sva_job_worker', {
    password: appPassword,
    user: 'sva_app',
  });
  if (!report.ok) {
    throw new Error(`graphile_contract_readiness_failed:${report.failedChecks.join(',')}`);
  }
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
      `SELECT graphile_worker.sva_enqueue_job(
        'studio_job_execute',
        '{"instanceId":"direct-login","jobId":"direct-login"}'::json,
        'plugin-operations',
        1,
        'studio-job:direct-login',
        now()
      );`
    ) === 0
  ) {
    throw new Error('graphile_contract_direct_login_enqueue_was_allowed');
  }
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

const assertEffectiveAppEnqueue = (port: string): void => {
  executeAsEffectiveApp(
    port,
    `SELECT graphile_worker.sva_enqueue_job(
      'studio_job_execute',
      '{"instanceId":"effective-role","jobId":"effective-role"}'::json,
      'plugin-operations',
      1,
      'studio-job:effective-role',
      now() + interval '1 day'
    );`
  );
  const queuedCount = psql(
    'sva_job_worker',
    workerPassword,
    port,
    "SELECT count(*) FROM graphile_worker.jobs WHERE key = 'studio-job:effective-role';"
  );
  if (queuedCount !== '1') {
    throw new Error(`graphile_contract_effective_app_enqueue_missing:${queuedCount}`);
  }
};

const main = async (): Promise<void> => {
  let runner: ContractRunner | undefined;
  let workerPool: ContractPool | undefined;
  try {
    const port = startContractDatabase();
    migrateGraphileWorker(port);
    await assertMissingWorkerRoleReadiness(port);
    seedLegacyAppMembership(port);
    bootstrapWorkerRole(port);
    await assertCanonicalWorkerReadiness(port);
    assertEffectiveAppEnqueue(port);
    enqueueContractJobs({
      executeAsApp: (sql) => executeAsEffectiveApp(port, sql),
      queryAsWorker: (sql) => psql('sva_job_worker', workerPassword, port, sql),
    });
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
