import {
  createMediaRepository,
  createStudioJobRepository,
  type MediaRepository,
  type SqlExecutionResult,
  type SqlExecutor,
  type SqlStatement,
} from '@sva/data-repositories';
import type { Pool } from 'pg';

import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { createMediaService, type MediaService } from './service.js';
import { enqueueStudioJobWithClient } from '../plugin-operations/runner-queue.js';

type WithResolvedInstanceDb = <T>(
  resolvePool: () => Pool | null,
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
) => Promise<T>;

type MediaRepositoryFactory = (executor: SqlExecutor) => MediaRepository;

type MediaRepositoryRuntimeDeps = {
  readonly resolvePool: () => Pool | null;
  readonly withDb: WithResolvedInstanceDb;
  readonly createRepository: MediaRepositoryFactory;
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

export const createWithMediaRepository =
  (deps: MediaRepositoryRuntimeDeps) =>
  async <T>(instanceId: string, work: (repository: MediaRepository) => Promise<T>): Promise<T> =>
    deps.withDb(deps.resolvePool, instanceId, async (client) =>
      work(deps.createRepository(createSqlExecutor(client)))
    );

const resolvePool = createPoolResolver(getIamDatabaseUrl);

export const withMediaRepository = createWithMediaRepository({
  resolvePool,
  withDb: withResolvedInstanceDb,
  createRepository: createMediaRepository,
});

export const withMediaService = async <T>(
  instanceId: string,
  work: (service: MediaService) => Promise<T>
): Promise<T> =>
  withMediaRepository(instanceId, async (repository) => work(createMediaService(repository)));

export const withMediaUploadJobRepositories = async <T>(
  instanceId: string,
  work: (repositories: {
    readonly media: MediaService;
    readonly jobs: ReturnType<typeof createStudioJobRepository>;
    readonly enqueue: (input: Parameters<typeof enqueueStudioJobWithClient>[1]) => Promise<void>;
  }) => Promise<T>
): Promise<T> =>
  withResolvedInstanceDb(resolvePool, instanceId, async (client) => {
    const executor = createSqlExecutor(client);
    return work({
      media: createMediaService(createMediaRepository(executor)),
      jobs: createStudioJobRepository(executor),
      enqueue: (input) => enqueueStudioJobWithClient(client, input),
    });
  });
