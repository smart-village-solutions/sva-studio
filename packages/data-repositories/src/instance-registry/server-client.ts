import { Pool } from 'pg';
import { createSdkLogger } from '@sva/server-runtime';

export const logger = createSdkLogger({ component: 'instance-registry-server', level: 'info' });

type QueryResult<TRow> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

export type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
  release(): void;
};

const poolsByDatabaseUrl = new Map<string, Pool>();

export const readErrorType = (error: unknown): string =>
  error instanceof Error && error.constructor?.name ? error.constructor.name : typeof error;

export const ensureValidIamDatabaseUrl = (databaseUrl: string | undefined): string | null => {
  if (!databaseUrl) {
    return null;
  }

  try {
    return new URL(databaseUrl).toString();
  } catch {
    throw new Error('iam_database_url_invalid');
  }
};

const buildDerivedIamDatabaseUrl = (): string | undefined => {
  const password = process.env.APP_DB_PASSWORD?.trim() ?? process.env.POSTGRES_PASSWORD?.trim();
  if (!password) {
    return undefined;
  }

  const user = process.env.APP_DB_USER?.trim() || 'sva_app';
  const database = process.env.POSTGRES_DB?.trim() || 'sva_studio';
  const host = process.env.POSTGRES_HOST?.trim() || 'postgres';
  const port = process.env.POSTGRES_PORT?.trim() || '5432';

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
};

export const resolveIamDatabaseUrl = (): string | undefined => {
  const explicit = process.env.IAM_DATABASE_URL?.trim();
  if (explicit) {
    try {
      return ensureValidIamDatabaseUrl(explicit) ?? undefined;
    } catch (error) {
      logger.warn(
        'Explicit IAM database URL is invalid; falling back to derived database credentials',
        {
          reason: 'iam_database_url_invalid',
          error_type: readErrorType(error),
        }
      );
    }
  }

  return buildDerivedIamDatabaseUrl();
};

const getPool = (databaseUrl: string | undefined): Pool | null => {
  const normalizedDatabaseUrl = ensureValidIamDatabaseUrl(databaseUrl);
  if (!normalizedDatabaseUrl) {
    logger.warn(
      'IAM database URL is not configured; instance-registry lookup cannot use the server repository',
      {
        reason: 'iam_database_url_missing',
      }
    );
    return null;
  }
  const existing = poolsByDatabaseUrl.get(normalizedDatabaseUrl);
  if (existing) {
    return existing;
  }

  const pool = new Pool({
    connectionString: normalizedDatabaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  poolsByDatabaseUrl.set(normalizedDatabaseUrl, pool);
  return pool;
};

export const withClient = async <T>(
  work: (client: QueryClient) => Promise<T>,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<T> => {
  const getDatabaseUrl = options.getDatabaseUrl ?? resolveIamDatabaseUrl;
  const pool = getPool(getDatabaseUrl());
  if (!pool) {
    throw new Error('iam_database_url_missing: IAM database not configured');
  }

  const client: QueryClient = await pool.connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
};

export const createExecutor = (client: QueryClient) => ({
  execute: async <TRow = Record<string, unknown>>(statement: {
    text: string;
    values: readonly unknown[];
  }) => {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

export const closeInstanceRegistryPools = async (): Promise<void> => {
  const poolsToClose = [...poolsByDatabaseUrl.values()];
  poolsByDatabaseUrl.clear();
  for (const pool of poolsToClose) {
    await pool.end();
  }
};
