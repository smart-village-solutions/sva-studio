import { Pool } from 'pg';

import {
  createCachedInstanceIntegrationLoader,
  createInstanceIntegrationRepository,
  type InstanceIntegrationRecord,
  type IntegrationProviderKey,
} from './instance-integrations';
import type { SqlStatement } from '../iam/repositories/types';

type QueryResult<TRow> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
  release(): void;
};

export type InstanceIntegrationServerLoaderOptions = {
  readonly cacheTtlMs?: number;
  readonly now?: () => number;
  readonly getDatabaseUrl?: () => string | undefined;
  readonly loadRecord?: (
    instanceId: string,
    providerKey: IntegrationProviderKey
  ) => Promise<InstanceIntegrationRecord | null>;
};

let pool: Pool | null = null;

const getPool = (getDatabaseUrl: () => string | undefined): Pool | null => {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return null;
  }

  pool ??= new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
  });

  return pool;
};

const withInstanceDb = async <T>(
  input: {
    readonly instanceId: string;
    readonly getDatabaseUrl: () => string | undefined;
  },
  work: (client: QueryClient) => Promise<T>
): Promise<T> => {
  const resolvedPool = getPool(input.getDatabaseUrl);
  if (!resolvedPool) {
    throw new Error('IAM database not configured');
  }

  const client = await resolvedPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', input.instanceId]);
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

const createExecutor = (client: QueryClient) => ({
  async execute<TRow = Record<string, unknown>>(statement: SqlStatement) {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

const buildLogContext = (instanceId: string, providerKey: IntegrationProviderKey, extra: Record<string, unknown> = {}) => ({
  workspace_id: instanceId,
  instance_id: instanceId,
  provider_key: providerKey,
  ...extra,
});

const queryInstanceIntegrationRecord = async (input: {
  readonly instanceId: string;
  readonly providerKey: IntegrationProviderKey;
  readonly getDatabaseUrl: () => string | undefined;
}): Promise<InstanceIntegrationRecord | null> => {
  return withInstanceDb(
    {
      instanceId: input.instanceId,
      getDatabaseUrl: input.getDatabaseUrl,
    },
    async (client) => {
      const repository = createInstanceIntegrationRepository(createExecutor(client));
      return repository.getByInstanceId(input.instanceId, input.providerKey);
    }
  );
};

const defaultCachedLoader = createCachedInstanceIntegrationLoader(
  (instanceId, providerKey) =>
    queryInstanceIntegrationRecord({
      instanceId,
      providerKey,
      getDatabaseUrl: () => process.env.IAM_DATABASE_URL,
    })
);

export const loadInstanceIntegrationRecord = async (
  instanceId: string,
  providerKey: IntegrationProviderKey,
  options: InstanceIntegrationServerLoaderOptions = {}
): Promise<InstanceIntegrationRecord | null> => {
  if (!options.now && !options.cacheTtlMs && !options.getDatabaseUrl && !options.loadRecord) {
    const record = await defaultCachedLoader.load(instanceId, providerKey);
    return record;
  }

  const getDatabaseUrl = options.getDatabaseUrl ?? (() => process.env.IAM_DATABASE_URL);
  const customLoader = createCachedInstanceIntegrationLoader(
    options.loadRecord ??
      ((currentInstanceId, currentProviderKey) =>
        queryInstanceIntegrationRecord({
          instanceId: currentInstanceId,
          providerKey: currentProviderKey,
          getDatabaseUrl,
        })),
    {
      cacheTtlMs: options.cacheTtlMs,
      now: options.now,
    }
  );

  const record = await customLoader.load(instanceId, providerKey);
  return record;
};

export const resetInstanceIntegrationServerState = async (): Promise<void> => {
  defaultCachedLoader.clear();

  if (pool) {
    const currentPool = pool;
    pool = null;
    await currentPool.end();
  }
};
