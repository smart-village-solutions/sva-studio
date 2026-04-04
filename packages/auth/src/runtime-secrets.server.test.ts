import { afterEach, describe, expect, it, vi } from 'vitest';

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
      IAM_DATABASE_URL:
        'postgresql://sva_app:DqdEmStmIk+/gqcHCdkngzuZqukFwikRhtInfN3ZmW2qcx8nBXoQDQIZncKYzHNV@postgres.sva.docker:5432/sva_studio',
      APP_DB_USER: 'sva_app',
      APP_DB_PASSWORD: 'DqdEmStmIk+/gqcHCdkngzuZqukFwikRhtInfN3ZmW2qcx8nBXoQDQIZncKYzHNV',
      POSTGRES_DB: 'sva_studio',
    };

    const { getIamDatabaseUrl } = await import('./runtime-secrets.server');

    expect(getIamDatabaseUrl()).toBe(
      'postgres://sva_app:DqdEmStmIk%2B%2FgqcHCdkngzuZqukFwikRhtInfN3ZmW2qcx8nBXoQDQIZncKYzHNV@postgres:5432/sva_studio'
    );
  });
});
