import { Pool, type PoolConfig } from 'pg';

export const SSF_DATABASE_URL_ENV = 'SVA_STUDIO_SSF_DATABASE_URL';

export interface SsfDatabaseConfig {
  readonly connectionString: string;
  readonly applicationName: 'sva-studio-ssf-runtime';
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
