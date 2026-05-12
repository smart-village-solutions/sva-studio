import { Pool } from 'pg';
import { createSdkLogger } from '@sva/server-runtime';

import type { SqlStatement } from '../iam/repositories/types.js';

const logger = createSdkLogger({ component: 'external-interfaces-server', level: 'info' });

type QueryResult<TRow> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

export type QueryClient = {
  query<TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<TRow>>;
  release(): void;
};

const poolsByDatabaseUrl = new Map<string, Pool>();

const getPool = (getDatabaseUrl: () => string | undefined): Pool | null => {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return null;
  }

  const existingPool = poolsByDatabaseUrl.get(databaseUrl);
  if (existingPool) {
    return existingPool;
  }

  const createdPool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  poolsByDatabaseUrl.set(databaseUrl, createdPool);
  return createdPool;
};

export const withIamDb = async <T>(
  input: {
    readonly instanceId: string;
    readonly getDatabaseUrl: () => string | undefined;
  },
  work: (client: QueryClient) => Promise<T>
): Promise<T> => {
  const resolvedPool = getPool(input.getDatabaseUrl);
  if (!resolvedPool) {
    logger.warn('database_not_configured', {
      operation: 'external_interface_db_tx',
      instance_id: input.instanceId,
    });
    throw new Error('IAM database not configured');
  }

  let client: QueryClient;
  try {
    client = await resolvedPool.connect();
  } catch (error) {
    logger.error('pool_connect_failed', {
      operation: 'external_interface_db_tx',
      instance_id: input.instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', input.instanceId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      logger.warn('external_interface_db_tx_rolled_back', {
        operation: 'external_interface_db_tx',
        instance_id: input.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // Rollback-Fehler bleiben untergeordnet.
    }

    logger.error('external_interface_db_tx_failed', {
      operation: 'external_interface_db_tx',
      instance_id: input.instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.release();
  }
};

export const createExecutor = (client: QueryClient) => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement) {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});
