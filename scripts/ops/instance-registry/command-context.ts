import { createRequire } from 'node:module';

import { createInstanceRegistryService } from '@sva/instance-registry/service';
import type { InstanceRegistryService } from '@sva/instance-registry/service-types';
import { createInstanceRegistryRepository } from '@sva/data';
import { invalidateInstanceRegistryHost } from '@sva/data/server';
import type { InstanceRegistryRepository, SqlExecutor, SqlStatement } from '@sva/data-repositories';
import { createSdkLogger, type ServerRuntimeLogger } from '@sva/server-runtime';

type QueryResult = {
  rowCount: number | null;
  rows: unknown[];
};

export type PoolClientLike = {
  query: (sql: string, values?: readonly unknown[]) => Promise<QueryResult>;
  release: () => void;
};

export type PoolLike = {
  connect: () => Promise<PoolClientLike>;
  query: (sql: string, values?: readonly unknown[]) => Promise<QueryResult>;
  end: () => Promise<void>;
};

type PgModule = {
  Pool: new (options: { connectionString: string; max: number; idleTimeoutMillis: number }) => PoolLike;
};

export type InstanceRegistryCommandContext = {
  readonly logger: ServerRuntimeLogger;
  close: () => Promise<void>;
  createReadService: () => InstanceRegistryService;
  withTransaction: <T>(work: (service: InstanceRegistryService) => Promise<T>) => Promise<T>;
};

type CreateInstanceRegistryCommandContextDeps = {
  readonly poolFactory?: (options: {
    connectionString: string;
    max: number;
    idleTimeoutMillis: number;
  }) => PoolLike;
  readonly serviceFactory?: (repository: InstanceRegistryRepository) => InstanceRegistryService;
};

const cliRequire = createRequire(import.meta.url);
const { Pool } = cliRequire('pg') as PgModule;

export const instanceRegistryCliLogger = createSdkLogger({
  component: 'instance-registry-cli',
  level: 'info',
});

export const createExecutor = (pool: PoolLike): SqlExecutor => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement) {
    const result = await pool.query(statement.text, [...statement.values]);
    return {
      rowCount: result.rowCount ?? 0,
      rows: result.rows as readonly TRow[],
    };
  },
});

export const createCliRepository = (executor: SqlExecutor): InstanceRegistryRepository => {
  const repository = createInstanceRegistryRepository(executor);
  return {
    ...repository,
    async getLatestTenantIamAccessProbe() {
      return null;
    },
    async getRoleReconcileSummary() {
      return null;
    },
  };
};

const createService = (repository: InstanceRegistryRepository): InstanceRegistryService =>
  createInstanceRegistryService({
    repository,
    invalidateHost: invalidateInstanceRegistryHost,
  });

export const createInstanceRegistryCommandContext = (
  databaseUrl: string,
  logger: ServerRuntimeLogger = instanceRegistryCliLogger,
  deps: CreateInstanceRegistryCommandContextDeps = {}
): InstanceRegistryCommandContext => {
  const pool = (deps.poolFactory ?? ((options) => new Pool(options)))({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 5_000,
  });
  const serviceFactory = deps.serviceFactory ?? createService;

  return {
    logger,
    close: () => pool.end(),
    createReadService: () => serviceFactory(createCliRepository(createExecutor(pool))),
    async withTransaction<T>(work: (service: InstanceRegistryService) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const repository = createCliRepository({
          execute: async <TRow = Record<string, unknown>>(statement: SqlStatement) => {
            const result = await client.query(statement.text, [...statement.values]);
            return {
              rowCount: result.rowCount ?? 0,
              rows: result.rows as readonly TRow[],
            };
          },
        });

        const result = await work(serviceFactory(repository));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.warn('Instance registry CLI rollback failed', {
            error_type: rollbackError instanceof Error ? rollbackError.constructor.name : typeof rollbackError,
            error_message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
        }

        throw error;
      } finally {
        client.release();
      }
    },
  };
};
