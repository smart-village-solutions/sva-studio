import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '@sva/data-repositories';
import { createSdkLogger } from '@sva/server-runtime';
import { findSelectedWasteManagementInterfaceRecord } from '@sva/waste-management-contracts';
import { Pool } from 'pg';
import { resolveWasteDataSource } from './repositories/data-source.server.js';
import { createWasteMasterDataRepository } from './repositories/master-data.js';
import { createWasteProvisioningAccess } from './repositories/waste-provisioning.js';
import type { WasteServerLoaderHost } from './server-loaders.js';

export type WasteRepository = ReturnType<typeof createWasteMasterDataRepository>;
type WasteDataSource = Awaited<ReturnType<typeof resolveWasteDataSource>>;
type WastePoolEntry = {
  readonly key: string;
  readonly dataSource: WasteDataSource;
  readonly pool: Pool;
  lastUsedAt: number;
};

export class WasteLoaderContext {
  private readonly provisioning;
  constructor(private readonly host: WasteServerLoaderHost) {
    this.provisioning = createWasteProvisioningAccess(host.withInstanceDb);
  }

  schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
  logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

  quoteIdentifier = (value: string): string => {
    if (!this.schemaIdentifierPattern.test(value)) throw new Error(`invalid_waste_schema:${value}`);
    return `"${value}"`;
  };

  setWasteSearchPath = async (
    client: {
      query: <TRow = Record<string, unknown>>(
        text: string,
        values?: readonly unknown[]
      ) => Promise<{ readonly rowCount: number | null; readonly rows: readonly TRow[] }>;
    },
    schemaName: string
  ): Promise<void> => {
    await client.query(`SET search_path TO ${this.quoteIdentifier(schemaName)}, public;`);
  };

  createSqlExecutor = (client: {
    query: <TRow = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[]
    ) => Promise<{ readonly rowCount: number | null; readonly rows: readonly TRow[] }>;
  }): SqlExecutor => ({
    async execute<TRow = Record<string, unknown>>(
      statement: SqlStatement
    ): Promise<SqlExecutionResult<TRow>> {
      const result = await client.query<TRow>(statement.text, statement.values);
      return { rowCount: result.rowCount ?? 0, rows: result.rows };
    },
  });

  wastePoolCache = new Map<string, WastePoolEntry>();
  WASTE_POOL_IDLE_TTL_MS = 5 * 60 * 1_000;
  WASTE_POOL_MAX_ENTRIES = 32;

  measureWasteStep = async <T>(
    operation: string,
    step: string,
    metadata: Record<string, unknown>,
    work: () => Promise<T>
  ): Promise<T> => {
    const startedAt = Date.now();
    try {
      return await work();
    } finally {
      this.logger.info('waste_management_loader_timing', {
        operation,
        step,
        duration_ms: Date.now() - startedAt,
        ...metadata,
      });
    }
  };

  measureWasteRepositoryStep = <T>(
    instanceId: string,
    operation: string,
    repositoryStep: string,
    work: () => Promise<T>
  ): Promise<T> =>
    this.measureWasteStep(
      operation,
      `repository.${repositoryStep}`,
      { instance_id: instanceId },
      work
    );

  createWastePoolKey = (dataSource: WasteDataSource): string =>
    `${dataSource.databaseUrl}::${dataSource.schemaName}`;

  loadSelectedWasteInterfaceRecord = async (instanceId: string) => {
    const records = await this.host.listExternalInterfaceRecords(instanceId);
    return (
      findSelectedWasteManagementInterfaceRecord(records) ??
      (await this.host.loadDefaultExternalInterfaceRecord(instanceId, 'postgresql'))
    );
  };

  resolveScopedWasteDataSource = (
    instanceId: string,
    operation: string
  ): Promise<WasteDataSource> =>
    this.measureWasteStep(operation, 'resolve_data_source', { instance_id: instanceId }, async () =>
      resolveWasteDataSource({
        instanceId,
        loadDefaultInterface: async () => await this.loadSelectedWasteInterfaceRecord(instanceId),
        loadProvisioning: this.provisioning.loadWasteTenantProvisioningRecord,
        revealSecret: (ciphertext, aad) => this.host.revealField(ciphertext, aad) ?? undefined,
      })
    );

  closeWastePoolEntry = async (entry: WastePoolEntry): Promise<void> => {
    const cachedEntry = this.wastePoolCache.get(entry.key);
    if (cachedEntry === entry) this.wastePoolCache.delete(entry.key);
    await entry.pool.end();
  };

  evictExpiredWastePoolEntries = async (now = Date.now()): Promise<void> => {
    const expiredEntries = [...this.wastePoolCache.values()].filter(
      (entry) => now - entry.lastUsedAt >= this.WASTE_POOL_IDLE_TTL_MS
    );
    await Promise.all(expiredEntries.map(async (entry) => this.closeWastePoolEntry(entry)));
  };

  evictLeastRecentlyUsedWastePoolEntry = async (): Promise<void> => {
    const oldestEntry = [...this.wastePoolCache.values()].reduce<WastePoolEntry | null>(
      (oldest, candidate) =>
        oldest === null || candidate.lastUsedAt < oldest.lastUsedAt ? candidate : oldest,
      null
    );
    if (oldestEntry) await this.closeWastePoolEntry(oldestEntry);
  };

  getOrCreateWastePoolEntry = async (
    dataSource: WasteDataSource,
    now = Date.now()
  ): Promise<WastePoolEntry> => {
    await this.evictExpiredWastePoolEntries(now);
    const key = this.createWastePoolKey(dataSource);
    const existingEntry = this.wastePoolCache.get(key);
    if (existingEntry) {
      existingEntry.lastUsedAt = now;
      return existingEntry;
    }
    if (this.wastePoolCache.size >= this.WASTE_POOL_MAX_ENTRIES)
      await this.evictLeastRecentlyUsedWastePoolEntry();
    const nextEntry: WastePoolEntry = {
      key,
      dataSource,
      pool: new Pool({
        connectionString: dataSource.databaseUrl,
        max: 2,
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 5_000,
      }),
      lastUsedAt: now,
    };
    this.wastePoolCache.set(key, nextEntry);
    return nextEntry;
  };

  resetWastePoolCache = async (): Promise<void> => {
    const entries = [...this.wastePoolCache.values()];
    this.wastePoolCache.clear();
    await Promise.all(entries.map(async (entry) => entry.pool.end()));
  };

  withWasteClient = async <T>(
    instanceId: string,
    operation: string,
    work: (client: {
      query: <TRow = Record<string, unknown>>(
        text: string,
        values?: readonly unknown[]
      ) => Promise<{ readonly rowCount: number | null; readonly rows: readonly TRow[] }>;
      release: () => void;
    }) => Promise<T>
  ): Promise<T> => {
    const dataSource = await this.resolveScopedWasteDataSource(instanceId, operation);
    const poolEntry = await this.getOrCreateWastePoolEntry(dataSource);
    const client = await this.measureWasteStep(
      operation,
      'acquire_pool_client',
      { instance_id: instanceId, schema_name: dataSource.schemaName },
      async () => {
        try {
          return await poolEntry.pool.connect();
        } catch (error) {
          await this.closeWastePoolEntry(poolEntry);
          throw error;
        }
      }
    );
    try {
      try {
        await this.measureWasteStep(
          operation,
          'set_search_path',
          { instance_id: instanceId, schema_name: dataSource.schemaName },
          async () => this.setWasteSearchPath(client, dataSource.schemaName)
        );
      } catch (error) {
        await this.closeWastePoolEntry(poolEntry);
        throw error;
      }
      poolEntry.lastUsedAt = Date.now();
      return await work(client);
    } finally {
      client.release();
    }
  };

  withWasteRepository = async <T>(
    instanceId: string,
    operation: string,
    work: (repository: WasteRepository) => Promise<T>
  ): Promise<T> =>
    this.withWasteClient(instanceId, operation, async (client) =>
      work(createWasteMasterDataRepository(this.createSqlExecutor(client)))
    );

  createLoader =
    <TArgs extends readonly unknown[], TResult>(
      operation: string,
      work: (repository: WasteRepository, ...args: TArgs) => Promise<TResult>
    ) =>
    (instanceId: string, ...args: TArgs) =>
      this.withWasteRepository(instanceId, operation, (repository) => work(repository, ...args));
}

export const createWasteLoaderContext = (host: WasteServerLoaderHost): WasteLoaderContext =>
  new WasteLoaderContext(host);
