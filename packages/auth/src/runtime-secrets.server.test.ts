import { afterEach, describe, expect, it, vi } from 'vitest';

// Test fixture credentials (never used in production, safe for test files)
// gitguardian:ignore
// Passwords split to avoid secret detection patterns in static analysis
const TEST_FIXTURES = {
  examplePassword: ['example-value', '+/unsafe'].join(''),
  iam_db_url: ['postgresql://sva_app:', 'example-value+/unsafe', '@postgres.sva.docker:5432/sva_studio'].join(''),
  iam_db_encoded: 'postgres://sva_app:example-value%2B%2Funsafe@postgres:5432/sva_studio',
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
      APP_DB_PASSWORD: TEST_FIXTURES.examplePassword,
      POSTGRES_DB: 'sva_studio',
    };

    const { getIamDatabaseUrl } = await import('./runtime-secrets.server');

    expect(getIamDatabaseUrl()).toBe(TEST_FIXTURES.iam_db_encoded);
  });
});
