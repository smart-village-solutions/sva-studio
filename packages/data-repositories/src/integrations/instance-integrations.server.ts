import {
  createCachedInstanceIntegrationLoader,
  createInstanceIntegrationRepository,
  type InstanceIntegrationRecord,
  type IntegrationProviderKey,
} from './instance-integrations.js';
import { createExecutor, resetInstanceIntegrationDb, withInstanceDb } from './instance-integrations.db.js';

export type InstanceIntegrationServerLoaderOptions = {
  readonly cacheTtlMs?: number;
  readonly now?: () => number;
  readonly getDatabaseUrl?: () => string | undefined;
  readonly loadRecord?: (
    instanceId: string,
    providerKey: IntegrationProviderKey
  ) => Promise<InstanceIntegrationRecord | null>;
};

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
const functionIds = new WeakMap<Function, number>();
let nextFunctionId = 1;

const getFunctionIdentity = (fn: unknown): string => {
  if (typeof fn !== 'function') {
    return 'none';
  }

  const existing = functionIds.get(fn);
  if (existing) {
    return String(existing);
  }

  const id = nextFunctionId;
  nextFunctionId += 1;
  functionIds.set(fn, id);
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

export const saveInstanceIntegrationRecord = async (
  record: InstanceIntegrationRecord,
  options: {
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<void> => {
  const getDatabaseUrl = options.getDatabaseUrl ?? (() => process.env.IAM_DATABASE_URL);

  await withInstanceDb(
    {
      instanceId: record.instanceId,
      getDatabaseUrl,
    },
    async (client) => {
      const repository = createInstanceIntegrationRepository(createExecutor(client));
      await repository.upsert(record);
    }
  );

  defaultCachedLoader.clear();
  for (const loader of customCachedLoaders.values()) {
    loader.clear();
  }
};

export const resetInstanceIntegrationServerState = async (): Promise<void> => {
  defaultCachedLoader.clear();
  for (const loader of customCachedLoaders.values()) {
    loader.clear();
  }
  customCachedLoaders.clear();

  await resetInstanceIntegrationDb();
};
