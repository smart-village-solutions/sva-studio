import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InstanceRegistryRecord } from '@sva/core';

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createInstanceRegistryRepository: vi.fn(),
  poolFactory: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
}));

vi.mock('pg', () => ({
  Pool: function MockPool(config: unknown) {
    return mocks.poolFactory(config);
  },
}));

vi.mock('./index.js', () => ({
  createInstanceRegistryRepository: (...args: unknown[]) => mocks.createInstanceRegistryRepository(...args),
}));

const originalEnv = {
  IAM_DATABASE_URL: process.env.IAM_DATABASE_URL,
  APP_DB_PASSWORD: process.env.APP_DB_PASSWORD,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  APP_DB_USER: process.env.APP_DB_USER,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  POSTGRES_PORT: process.env.POSTGRES_PORT,
};

const createInstanceRecord = (overrides: Partial<InstanceRegistryRecord> = {}): InstanceRegistryRecord => ({
  instanceId: 'tenant-a',
  displayName: 'Tenant A',
  status: 'active',
  parentDomain: 'example.test',
  primaryHostname: 'tenant-a.example.test',
  realmMode: 'shared',
  authRealm: 'sva',
  authClientId: 'studio',
  authIssuerUrl: null,
  authClientSecretConfigured: true,
  tenantAdminClient: {
    clientId: 'tenant-admin',
    secretConfigured: true,
  },
  tenantAdminBootstrap: null,
  assignedModules: [],
  featureFlags: {},
  mainserverConfigRef: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: null,
  updatedAt: '2026-01-02T00:00:00.000Z',
  updatedBy: null,
  ...overrides,
});

const clearDatabaseEnv = (): void => {
  delete process.env.IAM_DATABASE_URL;
  delete process.env.APP_DB_PASSWORD;
  delete process.env.POSTGRES_PASSWORD;
  delete process.env.APP_DB_USER;
  delete process.env.POSTGRES_DB;
  delete process.env.POSTGRES_HOST;
  delete process.env.POSTGRES_PORT;
};

const restoreDatabaseEnv = (): void => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const createPoolDouble = () => {
  const release = vi.fn();
  const end = vi.fn(async () => undefined);
  const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
  const connect = vi.fn(async () => ({
    query,
    release,
  }));

  return {
    pool: {
      connect,
      end,
    },
    connect,
    end,
    query,
    release,
  };
};

describe('instance registry server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    clearDatabaseEnv();
  });

  afterEach(() => {
    restoreDatabaseEnv();
  });

  it('throws and warns when hostname and instance lookups have no IAM database URL', async () => {
    const server = await import('./server.js');

    await expect(
      server.loadInstanceByHostname('Tenant-A.Example.Test', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');

    await expect(
      server.loadInstanceById('tenant-a', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');

    expect(mocks.poolFactory).not.toHaveBeenCalled();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Instance hostname lookup aborted because no IAM database URL could be resolved',
      expect.objectContaining({
        hostname: 'tenant-a.example.test',
        reason: 'iam_database_url_missing',
      })
    );
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'IAM database URL is not configured; instance-registry lookup cannot use the server repository',
      expect.objectContaining({
        reason: 'iam_database_url_missing',
      })
    );
  });

  it('serves cached hostname results without calling the repository twice', async () => {
    const server = await import('./server.js');
    const record = createInstanceRecord();
    const repository = {
      resolveHostname: vi.fn(async () => record),
      resolvePrimaryHostname: vi.fn(async () => null),
      getInstanceById: vi.fn(),
      getAuthClientSecretCiphertext: vi.fn(),
      getTenantAdminClientSecretCiphertext: vi.fn(),
    };
    const poolDouble = createPoolDouble();

    mocks.createInstanceRegistryRepository.mockReturnValue(repository);
    mocks.poolFactory.mockReturnValue(poolDouble.pool);

    const options = {
      getDatabaseUrl: () => 'postgres://db.example.test/sva',
      cacheTtlMs: 10_000,
      now: () => 1_000,
    };

    await expect(server.loadInstanceByHostname('Tenant-A.Example.Test', options)).resolves.toEqual(record);
    await expect(server.loadInstanceByHostname('tenant-a.example.test', options)).resolves.toEqual(record);

    expect(repository.resolveHostname).toHaveBeenCalledTimes(1);
    expect(repository.resolvePrimaryHostname).not.toHaveBeenCalled();
    expect(mocks.createInstanceRegistryRepository).toHaveBeenCalledTimes(1);
    expect(poolDouble.connect).toHaveBeenCalledTimes(1);
    expect(poolDouble.release).toHaveBeenCalledTimes(1);
  });

  it('caches null hostname lookups and skips repeated repository work for misses', async () => {
    const server = await import('./server.js');
    const repository = {
      resolveHostname: vi.fn(async () => null),
      resolvePrimaryHostname: vi.fn(async () => null),
      getInstanceById: vi.fn(),
      getAuthClientSecretCiphertext: vi.fn(),
      getTenantAdminClientSecretCiphertext: vi.fn(),
    };
    const poolDouble = createPoolDouble();

    mocks.createInstanceRegistryRepository.mockReturnValue(repository);
    mocks.poolFactory.mockReturnValue(poolDouble.pool);

    const options = {
      getDatabaseUrl: () => 'postgres://db.example.test/sva',
      cacheTtlMs: 10_000,
      now: () => 2_000,
    };

    await expect(server.loadInstanceByHostname('Missing.Example.Test', options)).resolves.toBeNull();
    await expect(server.loadInstanceByHostname('missing.example.test', options)).resolves.toBeNull();

    expect(repository.resolveHostname).toHaveBeenCalledTimes(1);
    expect(repository.resolvePrimaryHostname).toHaveBeenCalledTimes(1);
    expect(poolDouble.connect).toHaveBeenCalledTimes(1);
  });

  it('falls back to the primary hostname query when direct hostname resolution returns null', async () => {
    const server = await import('./server.js');
    const record = createInstanceRecord({ primaryHostname: 'fallback.example.test' });
    const repository = {
      resolveHostname: vi.fn(async () => null),
      resolvePrimaryHostname: vi.fn(async () => record),
      getInstanceById: vi.fn(),
      getAuthClientSecretCiphertext: vi.fn(),
      getTenantAdminClientSecretCiphertext: vi.fn(),
    };

    mocks.createInstanceRegistryRepository.mockReturnValue(repository);
    mocks.poolFactory.mockReturnValue(createPoolDouble().pool);

    await expect(
      server.loadInstanceByHostname('Fallback.Example.Test', {
        getDatabaseUrl: () => 'postgres://db.example.test/sva',
      })
    ).resolves.toEqual(record);

    expect(repository.resolveHostname).toHaveBeenCalledWith('fallback.example.test');
    expect(repository.resolvePrimaryHostname).toHaveBeenCalledWith('fallback.example.test');
  });

  it('retries with the primary hostname repository path after a retryable hostname error', async () => {
    const server = await import('./server.js');
    const record = createInstanceRecord({ primaryHostname: 'retry.example.test' });
    const repository = {
      resolveHostname: vi.fn(async () => {
        throw new Error('permission denied for relation iam.instance_hostnames');
      }),
      resolvePrimaryHostname: vi.fn(async () => record),
      getInstanceById: vi.fn(),
      getAuthClientSecretCiphertext: vi.fn(),
      getTenantAdminClientSecretCiphertext: vi.fn(),
    };

    mocks.createInstanceRegistryRepository.mockReturnValue(repository);
    mocks.poolFactory.mockReturnValue(createPoolDouble().pool);

    await expect(
      server.loadInstanceByHostname('Retry.Example.Test', {
        getDatabaseUrl: () => 'postgres://db.example.test/sva',
      })
    ).resolves.toEqual(record);

    expect(repository.resolvePrimaryHostname).toHaveBeenCalledWith('retry.example.test');
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Instance hostname lookup retried via primary_hostname fallback',
      expect.objectContaining({
        hostname: 'retry.example.test',
        reason_code: 'tenant_host_resolution_primary_hostname_fallback',
        instance_id: 'tenant-a',
      })
    );
  });

  it('wraps non-retryable repository failures and logs their error type', async () => {
    const server = await import('./server.js');
    const repository = {
      resolveHostname: vi.fn(async () => {
        throw 'repository unavailable';
      }),
      resolvePrimaryHostname: vi.fn(async () => null),
      getInstanceById: vi.fn(),
      getAuthClientSecretCiphertext: vi.fn(),
      getTenantAdminClientSecretCiphertext: vi.fn(),
    };

    mocks.createInstanceRegistryRepository.mockReturnValue(repository);
    mocks.poolFactory.mockReturnValue(createPoolDouble().pool);

    await expect(
      server.loadInstanceByHostname('Failure.Example.Test', {
        getDatabaseUrl: () => 'postgres://db.example.test/sva',
      })
    ).rejects.toThrow('tenant_host_resolution_failed');

    expect(repository.resolvePrimaryHostname).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Instance hostname lookup failed in repository layer',
      expect.objectContaining({
        hostname: 'failure.example.test',
        reason_code: 'tenant_host_resolution_failed',
        error_type: 'string',
      })
    );
  });

  it('wraps fallback failures after a retryable hostname error', async () => {
    const server = await import('./server.js');
    const repository = {
      resolveHostname: vi.fn(async () => {
        throw new Error('undefined_table: iam.instance_hostnames');
      }),
      resolvePrimaryHostname: vi.fn(async () => {
        throw new Error('fallback failed');
      }),
      getInstanceById: vi.fn(),
      getAuthClientSecretCiphertext: vi.fn(),
      getTenantAdminClientSecretCiphertext: vi.fn(),
    };

    mocks.createInstanceRegistryRepository.mockReturnValue(repository);
    mocks.poolFactory.mockReturnValue(createPoolDouble().pool);

    await expect(
      server.loadInstanceByHostname('Retry-Failure.Example.Test', {
        getDatabaseUrl: () => 'postgres://db.example.test/sva',
      })
    ).rejects.toThrow('tenant_host_resolution_fallback_failed');

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Instance hostname lookup failed in primary_hostname fallback',
      expect.objectContaining({
        hostname: 'retry-failure.example.test',
        reason_code: 'tenant_host_resolution_fallback_failed',
      })
    );
  });

  it('invalidates cached hostname entries and closes pools during server-state reset', async () => {
    const server = await import('./server.js');
    const record = createInstanceRecord();
    const repository = {
      resolveHostname: vi.fn(async () => record),
      resolvePrimaryHostname: vi.fn(async () => null),
      getInstanceById: vi.fn(async () => record),
      getAuthClientSecretCiphertext: vi.fn(async () => 'auth-secret'),
      getTenantAdminClientSecretCiphertext: vi.fn(async () => 'tenant-secret'),
    };
    const firstPool = createPoolDouble();
    const secondPool = createPoolDouble();

    mocks.createInstanceRegistryRepository.mockReturnValue(repository);
    mocks.poolFactory
      .mockReturnValueOnce(firstPool.pool)
      .mockReturnValueOnce(secondPool.pool);

    const options = {
      getDatabaseUrl: () => 'postgres://db.example.test/sva',
      cacheTtlMs: 10_000,
      now: () => 5_000,
    };

    await expect(server.loadInstanceByHostname('Invalidate.Example.Test', options)).resolves.toEqual(record);
    server.invalidateInstanceRegistryHost('INVALIDATE.EXAMPLE.TEST');
    await expect(server.loadInstanceByHostname('invalidate.example.test', options)).resolves.toEqual(record);

    await expect(
      server.loadInstanceAuthClientSecretCiphertext('tenant-a', {
        getDatabaseUrl: () => 'postgres://db.example.test/sva',
      })
    ).resolves.toBe('auth-secret');
    await expect(
      server.loadTenantAdminClientSecretCiphertext('tenant-a', {
        getDatabaseUrl: () => 'postgres://db.example.test/sva',
      })
    ).resolves.toBe('tenant-secret');

    expect(repository.resolveHostname).toHaveBeenCalledTimes(2);
    expect(firstPool.connect).toHaveBeenCalledTimes(4);

    await server.resetInstanceRegistryServerState();

    expect(firstPool.end).toHaveBeenCalledTimes(1);

    await expect(server.loadInstanceByHostname('invalidate.example.test', options)).resolves.toEqual(record);
    expect(secondPool.connect).toHaveBeenCalledTimes(1);
  });

  it('derives a fallback IAM database URL from env defaults when the explicit URL is invalid', async () => {
    const server = await import('./server.js');
    const record = createInstanceRecord({ instanceId: 'tenant-env' });
    const poolDouble = createPoolDouble();

    process.env.IAM_DATABASE_URL = '::not-a-url::';
    process.env.POSTGRES_PASSWORD = 'secret value';

    poolDouble.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ instance_id: 'tenant-env' }],
    });
    mocks.poolFactory.mockReturnValue(poolDouble.pool);
    mocks.createInstanceRegistryRepository.mockImplementation((executor: { execute: (statement: { text: string; values: readonly unknown[] }) => Promise<{ rowCount: number }> }) => ({
      resolveHostname: vi.fn(),
      resolvePrimaryHostname: vi.fn(),
      getInstanceById: async (instanceId: string) => {
        const result = await executor.execute({
          text: 'SELECT instance_id FROM iam.instances WHERE instance_id = $1',
          values: [instanceId],
        });
        return result.rowCount > 0 ? record : null;
      },
      getAuthClientSecretCiphertext: vi.fn(),
      getTenantAdminClientSecretCiphertext: vi.fn(),
    }));

    await expect(server.loadInstanceById('tenant-env')).resolves.toEqual(record);

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Explicit IAM database URL is invalid; falling back to derived database credentials',
      expect.objectContaining({
        reason: 'iam_database_url_invalid',
        error_type: 'Error',
      })
    );
    expect(mocks.poolFactory).toHaveBeenCalledWith({
      connectionString: 'postgres://sva_app:secret%20value@postgres:5432/sva_studio',
      max: 5,
      idleTimeoutMillis: 10_000,
    });
    expect(poolDouble.query).toHaveBeenCalledWith(
      'SELECT instance_id FROM iam.instances WHERE instance_id = $1',
      ['tenant-env']
    );
    expect(poolDouble.release).toHaveBeenCalledTimes(1);
  });
});
