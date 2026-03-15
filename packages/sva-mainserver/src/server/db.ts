import { Pool, type PoolClient } from 'pg';

type QueryResult<TRow> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

export type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
};

export const createPoolResolver = (getDatabaseUrl: () => string | undefined): (() => Pool | null) => {
  let pool: Pool | null = null;

  return () => {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      return null;
    }
    if (!pool) {
      pool = new Pool({
        connectionString: databaseUrl,
        max: 5,
        idleTimeoutMillis: 10_000,
      });
    }
    return pool;
  };
};

export const withInstanceDb = async <T>(
  resolvePool: () => Pool | null,
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('IAM database not configured');
  }

  const client = (await pool.connect()) as PoolClient & QueryClient;
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', instanceId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
