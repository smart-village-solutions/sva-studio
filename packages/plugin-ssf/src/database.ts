import { Pool, type PoolConfig } from 'pg';

export const SSF_DATABASE_URL_ENV = 'SVA_STUDIO_SSF_DATABASE_URL';
export const SSF_ROOT_DATABASE_URL_ENV = 'SVA_STUDIO_SSF_ROOT_DATABASE_URL';

export interface SsfDatabaseConfig {
  readonly connectionString: string;
  readonly applicationName: 'sva-studio-ssf-runtime' | 'sva-studio-ssf-root';
  readonly max: 10;
}

export const readSsfDatabaseConfig = (
  environment: NodeJS.ProcessEnv = process.env
): SsfDatabaseConfig | null => {
  const connectionString = environment[SSF_DATABASE_URL_ENV]?.trim();
  if (!connectionString) return null;
  return {
    connectionString,
    applicationName: 'sva-studio-ssf-runtime',
    max: 10,
  };
};

export const readSsfRootDatabaseConfig = (
  environment: NodeJS.ProcessEnv = process.env
): SsfDatabaseConfig | null => {
  const connectionString = environment[SSF_ROOT_DATABASE_URL_ENV]?.trim();
  if (!connectionString) return null;
  return {
    connectionString,
    applicationName: 'sva-studio-ssf-root',
    max: 10,
  };
};

export const createSsfDatabasePool = (
  config: SsfDatabaseConfig,
  overrides: Omit<PoolConfig, 'connectionString' | 'application_name' | 'max'> = {}
): Pool =>
  new Pool({
    ...overrides,
    connectionString: config.connectionString,
    application_name: config.applicationName,
    max: config.max,
  });

let configuredPool: Pool | undefined;
let configuredRootPool: Pool | undefined;

export const resolveSsfDatabasePool = (
  environment: NodeJS.ProcessEnv = process.env
): Pool | null => {
  const config = readSsfDatabaseConfig(environment);
  if (!config) return null;
  configuredPool ??= createSsfDatabasePool(config);
  return configuredPool;
};

export const resolveSsfRootDatabasePool = (
  environment: NodeJS.ProcessEnv = process.env
): Pool | null => {
  const config = readSsfRootDatabaseConfig(environment);
  if (!config) return null;
  configuredRootPool ??= createSsfDatabasePool(config);
  return configuredRootPool;
};

export const closeSsfDatabasePoolForShutdown = async (): Promise<void> => {
  const pool = configuredPool;
  const rootPool = configuredRootPool;
  configuredPool = undefined;
  configuredRootPool = undefined;
  try {
    await Promise.all([pool?.end(), rootPool?.end()]);
  } catch (error) {
    configuredPool ??= pool;
    configuredRootPool ??= rootPool;
    throw error;
  }
};
