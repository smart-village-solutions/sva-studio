import { afterEach, describe, expect, it, vi } from 'vitest';

const buildPostgresUrl = ({
  scheme,
  user,
  credential,
  host,
  port,
  database,
}: {
  scheme: 'postgres' | 'postgresql';
  user: string;
  credential: string;
  host: string;
  port: string;
  database: string;
}) => `${scheme}://${user}:${encodeURIComponent(credential)}@${host}:${port}/${database}`;

// Test fixture credentials (never used in production, safe for test files)
// gitguardian:ignore
// Credential fragments stay obviously synthetic while still exercising URL encoding.
const DB_CREDENTIAL = ['fixture', '-credential', '+', '/value'].join('');
const TEST_FIXTURES = {
  dbUser: 'sva_app',
  dbHost: 'postgres.sva.docker',
  dbPort: '5432',
  dbName: 'sva_studio',
  dbCredential: DB_CREDENTIAL,
  iam_db_url: buildPostgresUrl({
    scheme: 'postgresql',
    user: 'sva_app',
    credential: DB_CREDENTIAL,
    host: 'postgres.sva.docker',
    port: '5432',
    database: 'sva_studio',
  }).replace('%2B', '+').replace('%2F', '/'),
  iam_db_encoded: buildPostgresUrl({
    scheme: 'postgres',
    user: 'sva_app',
    credential: DB_CREDENTIAL,
    host: 'postgres',
    port: '5432',
    database: 'sva_studio',
  }),
} as const;

const originalEnv = { ...process.env };

describe('runtime-secrets.server', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('uses localhost redis for local runtime profiles without explicit REDIS_URL', async () => {
    process.env = {
      ...originalEnv,
      SVA_RUNTIME_PROFILE: 'local-builder',
    };
    delete process.env.REDIS_URL;

    const { getRedisUrl } = await import('./runtime-secrets.server');

    expect(getRedisUrl()).toBe('redis://localhost:6379');
  });

  it('keeps docker redis hostname for non-local runtime profiles', async () => {
    process.env = {
      ...originalEnv,
      SVA_RUNTIME_PROFILE: 'acceptance-hb',
    };
    delete process.env.REDIS_URL;

    const { getRedisUrl } = await import('./runtime-secrets.server');

    expect(getRedisUrl()).toBe('redis://redis:6379');
  });

  it('derives an encoded IAM database URL when an explicit url is invalid', async () => {
    process.env = {
      ...originalEnv,
      IAM_DATABASE_URL: TEST_FIXTURES.iam_db_url,
      APP_DB_USER: 'sva_app',
      APP_DB_PASSWORD: TEST_FIXTURES.dbCredential,
      POSTGRES_DB: 'sva_studio',
    };

    const { getIamDatabaseUrl } = await import('./runtime-secrets.server');

    expect(getIamDatabaseUrl()).toBe(TEST_FIXTURES.iam_db_encoded);
  });
});
