import {
  createStudioJobRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
  type StudioJobRepository,
} from '@sva/data-repositories';
import type { Pool } from 'pg';

import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';

type WithResolvedInstanceDb = <T>(
  resolvePool: () => Pool | null,
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
) => Promise<T>;

type StudioJobRepositoryFactory = (executor: SqlExecutor) => StudioJobRepository;

type StudioJobRepositoryRuntimeDeps = {
  readonly resolvePool: () => Pool | null;
  readonly withDb: WithResolvedInstanceDb;
  readonly createRepository: StudioJobRepositoryFactory;
};

const createSqlExecutor = (client: QueryClient): SqlExecutor => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

export const createWithStudioJobRepository = (deps: StudioJobRepositoryRuntimeDeps) =>
  async <T>(instanceId: string, work: (repository: StudioJobRepository) => Promise<T>): Promise<T> =>
    deps.withDb(deps.resolvePool, instanceId, async (client) => work(deps.createRepository(createSqlExecutor(client))));

const resolvePool = createPoolResolver(getIamDatabaseUrl);

export const withStudioJobRepository = createWithStudioJobRepository({
  resolvePool,
  withDb: withResolvedInstanceDb,
  createRepository: createStudioJobRepository,
});
