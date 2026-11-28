import {
  createPluginTenantLifecycleRepository,
  createStudioJobRepository,
  type PluginTenantLifecycleRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
  type StudioJobRepository,
} from '@sva/data-repositories';
import type { Pool } from 'pg';
import type { StudioJobRecord } from '@sva/core';

import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { pluginTenantLifecycleJobInputKey } from '../plugin-tenant-lifecycle/job-correlation.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import {
  enqueuePluginTenantLifecycleRecovery,
  enqueuePluginTenantLifecycleRetry,
  enqueueStudioJobWithClient,
} from './runner-queue.js';

type WithResolvedInstanceDb = <T>(
  resolvePool: () => Pool | null,
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
) => Promise<T>;

type StudioJobRepositoryFactory = (executor: SqlExecutor) => StudioJobRepository;
type PluginTenantLifecycleRepositoryFactory = (
  executor: SqlExecutor
) => PluginTenantLifecycleRepository;

type StudioJobRepositoryRuntimeDeps = {
  readonly resolvePool: () => Pool | null;
  readonly withDb: WithResolvedInstanceDb;
  readonly createRepository: StudioJobRepositoryFactory;
};

const createSqlExecutor = (client: QueryClient): SqlExecutor => ({
  async execute<TRow = Record<string, unknown>>(
    statement: SqlStatement
  ): Promise<SqlExecutionResult<TRow>> {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

export const createWithStudioJobRepository =
  (deps: StudioJobRepositoryRuntimeDeps) =>
  async <T>(
    instanceId: string,
    work: (repository: StudioJobRepository) => Promise<T>
  ): Promise<T> =>
    deps.withDb(deps.resolvePool, instanceId, async (client) =>
      work(deps.createRepository(createSqlExecutor(client)))
    );

const resolvePool = createPoolResolver(getIamDatabaseUrl);

export const closeStudioJobRepositoryPoolForShutdown = async (): Promise<void> => {
  await resolvePool()?.end();
};

export const withStudioJobRepository = createWithStudioJobRepository({
  resolvePool,
  withDb: withResolvedInstanceDb,
  createRepository: createStudioJobRepository,
});

const withStudioJobReconciliationDb = <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> =>
  withResolvedInstanceDb(resolvePool, instanceId, async (client) => {
    await client.query("SET LOCAL statement_timeout = '3s'; SET LOCAL lock_timeout = '500ms'");
    return work(client);
  });

const reconcilableJobPredicate = `
  status IN ('queued', 'running', 'retrying')
  AND (source = 'host' OR NOT (input_payload ? $3))
  AND scheduled_at <= now()
  AND coalesce(heartbeat_at, started_at, updated_at) <= now() - interval '120 seconds'
`;

export const listStudioJobReconciliationCandidates = async (
  instanceId: string,
  afterId: string | null,
  limit: number
): Promise<readonly string[]> =>
  withStudioJobReconciliationDb(instanceId, async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM iam.studio_jobs
       WHERE instance_id = $1 AND ($2::uuid IS NULL OR id > $2)
         AND ${reconcilableJobPredicate}
       ORDER BY id LIMIT $4`,
      [instanceId, afterId, pluginTenantLifecycleJobInputKey, limit]
    );
    return result.rows.map(({ id }) => id);
  });

export const withStudioJobReconciliationCandidate = async <T>(
  instanceId: string,
  jobId: string,
  work: (
    job: StudioJobRecord,
    repository: StudioJobRepository,
    lockExhaustedQueueEntry: (taskIdentifier: string) => Promise<boolean | null>
  ) => Promise<T>
): Promise<T | undefined> =>
  withStudioJobReconciliationDb(instanceId, async (client) => {
    const claim = await client.query(
      `SELECT id FROM iam.studio_jobs
       WHERE instance_id = $1 AND id = $2 AND ${reconcilableJobPredicate}
       FOR UPDATE SKIP LOCKED`,
      [instanceId, jobId, pluginTenantLifecycleJobInputKey]
    );
    if (claim.rowCount === 0) return;

    const repository = createStudioJobRepository(createSqlExecutor(client));
    const job = await repository.getJobById(instanceId, jobId);
    if (!job) return;
    return work(job, repository, async (taskIdentifier) => {
      const result = await client.query<{ exhausted: boolean | null }>(
        'SELECT graphile_worker.sva_lock_exhausted_studio_job($1, $2, $3, $4) AS exhausted',
        [job.id, taskIdentifier, job.queueName, job.attempts]
      );
      return result.rows[0]?.exhausted ?? null;
    });
  });

export const createWithPluginTenantLifecycleRepository =
  (deps: {
    readonly resolvePool: () => Pool | null;
    readonly withDb: WithResolvedInstanceDb;
    readonly createRepository: PluginTenantLifecycleRepositoryFactory;
  }) =>
  async <T>(
    instanceId: string,
    work: (repository: PluginTenantLifecycleRepository) => Promise<T>
  ): Promise<T> =>
    deps.withDb(deps.resolvePool, instanceId, async (client) =>
      work(deps.createRepository(createSqlExecutor(client)))
    );

export const withPluginTenantLifecycleRepository = createWithPluginTenantLifecycleRepository({
  resolvePool,
  withDb: withResolvedInstanceDb,
  createRepository: createPluginTenantLifecycleRepository,
});

export const withStudioJobLifecycleRepositories = async <T>(
  instanceId: string,
  work: (repositories: {
    readonly studioJobs: StudioJobRepository;
    readonly tenantLifecycle: PluginTenantLifecycleRepository;
    readonly enqueuePluginTenantLifecycleRetry: (input: {
      readonly instanceId: string;
      readonly pluginId: string;
      readonly runAt: Date;
    }) => Promise<unknown>;
    readonly enqueuePluginTenantLifecycleRecovery: (input: {
      readonly instanceId: string;
      readonly pluginId: string;
      readonly runAt: Date;
    }) => Promise<unknown>;
    readonly enqueueStudioJob: (
      input: Parameters<typeof enqueueStudioJobWithClient>[1]
    ) => Promise<void>;
  }) => Promise<T>
): Promise<T> =>
  withResolvedInstanceDb(resolvePool, instanceId, async (client) => {
    const executor = createSqlExecutor(client);
    return work({
      studioJobs: createStudioJobRepository(executor),
      tenantLifecycle: createPluginTenantLifecycleRepository(executor),
      enqueuePluginTenantLifecycleRetry: (input) =>
        enqueuePluginTenantLifecycleRetry(client, input),
      enqueuePluginTenantLifecycleRecovery: (input) =>
        enqueuePluginTenantLifecycleRecovery(client, input),
      enqueueStudioJob: (input) => enqueueStudioJobWithClient(client, input),
    });
  });
