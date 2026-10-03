import { randomUUID } from 'node:crypto';

export const rootDir = process.cwd();
export const containerName = `sva-lifecycle-contract-${process.pid}-${randomUUID().slice(0, 8)}`;
export const database = 'sva_studio';
export const adminPassword = 'lifecycle-contract-admin';
export const appPassword = 'lifecycle-contract-app';
export const workerPassword = 'lifecycle-contract-worker';
export const instanceId = '00000000-0000-4000-8000-000000000040';
export const pluginId = 'fault-plugin';
export const activationPluginId = 'act-plugin';
export const observabilityOtherInstanceId = '00000000-0000-4000-8000-000000000041';
export const jobTypeId = 'fault-plugin.provision';
export const queueName = 'plugin-tenant-lifecycle-contract';
export const privilegedQueueName = 'plugin-tenant-lifecycle-privileged-contract';
export type QueryResult<TRow> = { readonly rowCount: number | null; readonly rows: TRow[] };
export type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
  release?: () => void;
};
export type ContractPool = QueryClient & {
  connect(): Promise<QueryClient>;
  end(): Promise<void>;
};
export type ContractRunner = { gracefulShutdown(): Promise<void> };

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`plugin_lifecycle_contract_assertion:${message}`);
}

export const waitFor = async (
  description: string,
  probe: () => Promise<boolean>
): Promise<void> => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`plugin_lifecycle_contract_timeout:${description}`);
};

export const scalar = async (pool: QueryClient, sql: string, values: readonly unknown[] = []) => {
  const result = await pool.query<{ value: string }>(sql, values);
  return result.rows[0]?.value;
};
