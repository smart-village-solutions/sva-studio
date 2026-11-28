import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  adminPassword,
  appPassword,
  database,
  psql,
  psqlStatus,
} from './graphile-worker-contract-database.js';

type ContractJobDatabase = {
  readonly executeAsApp: (sql: string) => string;
  readonly queryAsWorker: (sql: string) => string;
};

export const enqueueContractJobs = (database: ContractJobDatabase): void => {
  database.executeAsApp(`SELECT graphile_worker.sva_enqueue_job(
    'studio_job_execute',
    '{"instanceId":"contract","jobId":"contract-job"}'::json,
    'plugin-operations',
    5,
    'studio-job:contract-job',
    NULL
  );`);
  const queuedCount = database.queryAsWorker(
    "SELECT count(*) FROM graphile_worker.jobs WHERE key = 'studio-job:contract-job';"
  );
  if (queuedCount !== '1') throw new Error(`graphile_contract_job_not_visible:${queuedCount}`);

  database.executeAsApp(`SELECT graphile_worker.sva_enqueue_job(
    'plugin_tenant_lifecycle_retry',
    '{"instanceId":"contract"}'::json,
    'plugin-tenant-lifecycle',
    5,
    'plugin-tenant-lifecycle-retry:contract',
    now() + interval '1 day'
  );`);
  const lifecycleRetryCount = database.queryAsWorker(
    "SELECT count(*) FROM graphile_worker.jobs WHERE key = 'plugin-tenant-lifecycle-retry:contract';"
  );
  if (lifecycleRetryCount !== '1') {
    throw new Error(`graphile_contract_lifecycle_retry_not_visible:${lifecycleRetryCount}`);
  }
};

const reconciliationTenant = 'abandoned-job-contract';
const reconciliationQueue = 'abandoned-job-contract';
const reconciliationJobType = 'contract.reconciliation';
const task = 'studio_job_execute';
const checkFunction = 'graphile_worker.sva_lock_exhausted_studio_job';

const createReconciliationFixtureTables = (run: (sql: string) => string): void => {
  const snapshot = readFileSync('docs/development/studio-db-schema-final.sql', 'utf8');
  for (const pattern of [
    /CREATE TABLE iam\.studio_jobs \([\s\S]+?\n\);/,
    /CREATE TABLE iam\.studio_job_events \([\s\S]+?\n\);/,
    /CREATE UNIQUE INDEX idx_studio_job_events_terminal_attempt [^;]+;/,
  ]) {
    const statement = snapshot.match(pattern)?.[0];
    assert.ok(statement, 'missing Studio job schema in the snapshot');
    run(statement);
  }
  run(
    'GRANT USAGE ON SCHEMA iam TO iam_app; GRANT SELECT, INSERT, UPDATE ON iam.studio_jobs, iam.studio_job_events TO iam_app'
  );
};

const enqueueReconciliationJob = (id: string, taskIdentifier = task) =>
  `SELECT graphile_worker.sva_enqueue_job('${taskIdentifier}',
    '{"instanceId":"${reconciliationTenant}","jobId":"${id}"}'::json,
    '${reconciliationQueue}', 1, 'studio-job:${id}', now() + interval '1 day')`;
const seedReconciliationJob = (
  run: (sql: string) => string,
  state: 'running' | 'queued' = 'running',
  taskIdentifier = task
): string => {
  const id = randomUUID();
  run(`INSERT INTO iam.studio_jobs (
    id, instance_id, job_type_id, queue_name, status, input_payload, attempts, idempotency_key,
    scheduled_at, started_at, heartbeat_at, updated_at, worker_id, cancel_requested_at, source
  ) VALUES (
    '${id}', '${reconciliationTenant}', '${reconciliationJobType}', '${reconciliationQueue}',
    '${state}', '{}', ${state === 'running' ? 1 : 0}, '${id}', now() - interval '5 minutes',
    ${
      state === 'running'
        ? "now() - interval '4 minutes', now() - interval '3 minutes', now() - interval '3 minutes', 'fixture-worker'"
        : "NULL, NULL, now() - interval '3 minutes', NULL"
    }, now() - interval '2 minutes', 'host'
  );
  ${enqueueReconciliationJob(id, taskIdentifier)};
  UPDATE graphile_worker._private_jobs SET attempts = max_attempts WHERE key = 'studio-job:${id}';`);
  return id;
};

type ConnectReconciliationFixture = () => Promise<{
  query: (sql: string) => Promise<{ rows: { exhausted?: boolean }[] }>;
  release: () => void;
}>;

const assertQueueCoordination = async (
  port: string,
  connect: ConnectReconciliationFixture,
  abandoned: string,
  reconcile: () => Promise<string | undefined>
): Promise<void> => {
  const run = (sql: string) => psql('postgres', adminPassword, port, sql);
  const claim = await connect();
  try {
    await claim.query('BEGIN');
    await claim.query(`UPDATE graphile_worker._private_jobs
       SET locked_at = now(), locked_by = 'fixture-claim' WHERE key = 'studio-job:${abandoned}'`);
    assert.equal(await reconcile(), 'unknown');
    await claim.query('COMMIT');
    assert.equal(await reconcile(), 'available');
  } finally {
    await claim.query('ROLLBACK');
    claim.release();
  }
  run(`UPDATE graphile_worker._private_jobs SET locked_at = NULL, locked_by = NULL
    WHERE key = 'studio-job:${abandoned}'`);

  const lock = await connect();
  try {
    await lock.query(
      `BEGIN; SET LOCAL ROLE iam_app; SET LOCAL app.instance_id = '${reconciliationTenant}'`
    );
    const probe = await lock.query(
      `SELECT ${checkFunction}('${abandoned}', '${task}', '${reconciliationQueue}', 1) AS exhausted`
    );
    assert.equal(probe.rows[0]?.exhausted, true);
    assert.notEqual(
      psqlStatus(
        'postgres',
        adminPassword,
        port,
        `SET lock_timeout = '200ms'; ${enqueueReconciliationJob(abandoned)}`
      ),
      0,
      'concurrent enqueue acquired a held lock'
    );
  } finally {
    await lock.query('ROLLBACK');
    lock.release();
  }
};

export const assertStudioJobReconciliation = async (
  port: string,
  connect: ConnectReconciliationFixture
): Promise<void> => {
  const run = (sql: string) => psql('postgres', adminPassword, port, sql);
  createReconciliationFixtureTables(run);
  const originalDatabaseUrl = process.env.IAM_DATABASE_URL;
  process.env.IAM_DATABASE_URL = `postgres://sva_app:${appPassword}@127.0.0.1:${port}/${database}`;
  const { reconcileStudioJob } =
    await import('../../packages/auth-runtime/dist/plugin-operations/runner-reconciliation.js');
  const { registerStudioJobExecutionHandlers } =
    await import('../../packages/auth-runtime/dist/plugin-operations/runner-internal.js');
  const {
    closeStudioJobRepositoryPoolForShutdown,
    listStudioJobReconciliationCandidates,
    withStudioJobRepository,
  } = await import('../../packages/auth-runtime/dist/plugin-operations/repository.js');
  registerStudioJobExecutionHandlers([
    {
      source: 'host',
      jobTypeId: reconciliationJobType,
      queueName: reconciliationQueue,
      handler: async () => {
        throw new Error('reconciliation_must_not_execute_handler');
      },
    },
  ]);

  const countTerminalEvents = (id: string): string =>
    run(
      `SELECT count(*) FROM iam.studio_job_events WHERE job_id = '${id}'
       AND event_type IN ('job.failed', 'job.cancelled', 'job.succeeded')`
    );

  try {
    const abandoned = seedReconciliationJob(run);
    const fresh = seedReconciliationJob(run);
    run(`UPDATE iam.studio_jobs SET heartbeat_at = now() WHERE id = '${fresh}'`);
    const cancelled = seedReconciliationJob(run, 'queued');
    const wrongLane = seedReconciliationJob(run, 'running', 'studio_job_execute_privileged');
    const lifecycle = seedReconciliationJob(run);
    run(
      `UPDATE iam.studio_jobs SET source = 'plugin', input_payload = '{"studioTenantLifecycle":{}}' WHERE id = '${lifecycle}'`
    );
    const unavailable = seedReconciliationJob(run);

    const candidates = await listStudioJobReconciliationCandidates(reconciliationTenant, null, 25);
    assert.ok(candidates.includes(abandoned));
    assert.ok(!candidates.includes(fresh) && !candidates.includes(lifecycle));
    assert.equal(await reconcileStudioJob(reconciliationTenant, fresh), undefined);
    assert.equal(await reconcileStudioJob(reconciliationTenant, lifecycle), undefined);
    assert.equal(await reconcileStudioJob(reconciliationTenant, wrongLane), 'unknown');
    assert.equal(await reconcileStudioJob('another-tenant', abandoned), undefined);
    assert.equal(
      run(`SET ROLE iam_app; SET app.instance_id = 'another-tenant';
        SELECT coalesce(${checkFunction}('${abandoned}', '${task}', '${reconciliationQueue}', 1)::text, 'unknown')`)
        .split('\n')
        .at(-1),
      'unknown'
    );
    assert.notEqual(
      psqlStatus(
        'sva_app',
        appPassword,
        port,
        `SELECT ${checkFunction}('${abandoned}', '${task}', '${reconciliationQueue}', 1)`
      ),
      0
    );

    await assertQueueCoordination(port, connect, abandoned, () =>
      reconcileStudioJob(reconciliationTenant, abandoned)
    );

    const outcomes = await Promise.all([
      reconcileStudioJob(reconciliationTenant, abandoned),
      reconcileStudioJob(reconciliationTenant, abandoned),
    ]);
    assert.equal(outcomes.filter((result) => result === 'finalized').length, 1);
    assert.equal(countTerminalEvents(abandoned), '1');
    assert.equal(await reconcileStudioJob(reconciliationTenant, abandoned), undefined);
    assert.equal(await reconcileStudioJob(reconciliationTenant, cancelled), 'finalized');
    assert.equal(countTerminalEvents(cancelled), '1');
    await withStudioJobRepository(reconciliationTenant, async (jobs) => {
      const failed = await jobs.getJobById(reconciliationTenant, abandoned);
      assert.equal(failed?.status, 'failed');
      assert.equal(failed.errorPayload?.code, 'studio_job_execution_abandoned');
      assert.ok(failed.cancelRequestedAt);
      assert.equal((await jobs.getJobById(reconciliationTenant, cancelled))?.status, 'cancelled');
      const active = await jobs.listJobs(reconciliationTenant, {
        view: 'active',
        page: 1,
        pageSize: 25,
      });
      assert.ok(!active.items.some(({ id }) => id === abandoned || id === cancelled));
    });

    run('REVOKE INSERT ON iam.studio_job_events FROM iam_app');
    assert.equal(await reconcileStudioJob(reconciliationTenant, unavailable), 'unresolved');
    assert.equal(countTerminalEvents(unavailable), '0');
    assert.equal(run(`SELECT status FROM iam.studio_jobs WHERE id = '${unavailable}'`), 'running');
    run('GRANT INSERT ON iam.studio_job_events TO iam_app');
    run(`REVOKE EXECUTE ON FUNCTION ${checkFunction}(uuid, text, text, integer) FROM iam_app`);
    await assert.rejects(reconcileStudioJob(reconciliationTenant, unavailable), { code: '42501' });
    assert.equal(countTerminalEvents(unavailable), '0');
  } finally {
    await closeStudioJobRepositoryPoolForShutdown();
    if (originalDatabaseUrl === undefined) delete process.env.IAM_DATABASE_URL;
    else process.env.IAM_DATABASE_URL = originalDatabaseUrl;
  }
};
