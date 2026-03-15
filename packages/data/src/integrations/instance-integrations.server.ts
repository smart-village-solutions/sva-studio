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
    try {
      await client.query('ROLLBACK');
    } catch {
      // Der ursprüngliche Fehler bleibt führend; Rollback-Fehler sollen ihn nicht überdecken.
    }
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

const customCachedLoaders = new Map<string, ReturnType<typeof createCachedInstanceIntegrationLoader>>();
const functionIds = new WeakMap<(...args: never[]) => unknown, number>();
let nextFunctionId = 1;

const getFunctionIdentity = (fn: unknown): string => {
  if (typeof fn !== 'function') {
    return 'none';
  }

  const functionRef = fn as (...args: never[]) => unknown;
  const existing = functionIds.get(functionRef);
  if (existing) {
    return String(existing);
  }

  const id = nextFunctionId;
  nextFunctionId += 1;
  functionIds.set(functionRef, id);
  return String(id);
};

const getCustomLoaderKey = (options: InstanceIntegrationServerLoaderOptions): string =>
  [
    String(options.cacheTtlMs ?? 0),
    getFunctionIdentity(options.now),
    getFunctionIdentity(options.getDatabaseUrl),
    getFunctionIdentity(options.loadRecord),
  ].join('|');

const getOrCreateCustomLoader = (
  options: InstanceIntegrationServerLoaderOptions
): ReturnType<typeof createCachedInstanceIntegrationLoader> => {
  const key = getCustomLoaderKey(options);
  const existing = customCachedLoaders.get(key);
  if (existing) {
    return existing;
  }

  const getDatabaseUrl = options.getDatabaseUrl ?? (() => process.env.IAM_DATABASE_URL);

  const created = createCachedInstanceIntegrationLoader(
    options.loadRecord ??
      ((instanceId, providerKey) =>
        queryInstanceIntegrationRecord({
          instanceId,
          providerKey,
          getDatabaseUrl,
        })),
    {
      cacheTtlMs: options.cacheTtlMs,
      now: options.now,
    }
  );
  customCachedLoaders.set(key, created);
  return created;
};

export const loadInstanceIntegrationRecord = async (
  instanceId: string,
  providerKey: IntegrationProviderKey,
  options: InstanceIntegrationServerLoaderOptions = {}
): Promise<InstanceIntegrationRecord | null> => {
  const usesDefaultLoader =
    options.now === undefined &&
    options.cacheTtlMs === undefined &&
    options.getDatabaseUrl === undefined &&
    options.loadRecord === undefined;

  if (usesDefaultLoader) {
    const record = await defaultCachedLoader.load(instanceId, providerKey);
    return record;
  }

  const customLoader = getOrCreateCustomLoader(options);
  const record = await customLoader.load(instanceId, providerKey);
  return record;
};

export const resetInstanceIntegrationServerState = async (): Promise<void> => {
  defaultCachedLoader.clear();
  for (const loader of customCachedLoaders.values()) {
    loader.clear();
  }
  customCachedLoaders.clear();

  if (pool) {
    const currentPool = pool;
    pool = null;
    await currentPool.end();
  }
};
