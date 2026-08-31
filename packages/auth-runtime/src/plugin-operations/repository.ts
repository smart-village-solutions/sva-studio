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

import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import {
  enqueuePluginTenantLifecycleRecovery,
  enqueuePluginTenantLifecycleRetry,
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

export const withStudioJobRepository = createWithStudioJobRepository({
  resolvePool,
  withDb: withResolvedInstanceDb,
  createRepository: createStudioJobRepository,
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
    });
  });
