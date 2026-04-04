import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveHostnameMock = vi.hoisted(() => vi.fn());
const getInstanceByIdMock = vi.hoisted(() => vi.fn());
const getAuthClientSecretCiphertextMock = vi.hoisted(() => vi.fn());
const createInstanceRegistryRepositoryMock = vi.hoisted(() =>
  vi.fn(() => ({
    resolveHostname: resolveHostnameMock,
    getInstanceById: getInstanceByIdMock,
    getAuthClientSecretCiphertext: getAuthClientSecretCiphertextMock,
  }))
);
const connectMock = vi.hoisted(() => vi.fn());
const poolInstances: Array<{ end?: () => Promise<void> }> = [];

const PoolMock = vi.hoisted(() =>
  vi.fn().mockImplementation(function MockPool() {
    const pool = {
      connect: connectMock,
      end: vi.fn(async () => undefined),
    };
    poolInstances.push(pool);
    return pool;
  })
);

vi.mock('pg', () => ({
  Pool: PoolMock,
}));

vi.mock('./index', () => ({
  createInstanceRegistryRepository: createInstanceRegistryRepositoryMock,
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('instance-registry server helpers', () => {
  const originalDatabaseUrl = process.env.IAM_DATABASE_URL;
  const originalAppDbPassword = process.env.APP_DB_PASSWORD;
  const originalPostgresPassword = process.env.POSTGRES_PASSWORD;
  const originalAppDbUser = process.env.APP_DB_USER;
  const originalPostgresDb = process.env.POSTGRES_DB;
  const originalPostgresHost = process.env.POSTGRES_HOST;
  const originalPostgresPort = process.env.POSTGRES_PORT;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    poolInstances.splice(0, poolInstances.length);
    connectMock.mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      release: vi.fn(),
    });
    resolveHostnameMock.mockResolvedValue(null);
    getInstanceByIdMock.mockResolvedValue(null);
    getAuthClientSecretCiphertextMock.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.IAM_DATABASE_URL = originalDatabaseUrl;
    process.env.APP_DB_PASSWORD = originalAppDbPassword;
    process.env.POSTGRES_PASSWORD = originalPostgresPassword;
    process.env.APP_DB_USER = originalAppDbUser;
    process.env.POSTGRES_DB = originalPostgresDb;
    process.env.POSTGRES_HOST = originalPostgresHost;
    process.env.POSTGRES_PORT = originalPostgresPort;
  });

  it('throws when the IAM database is not configured', async () => {
    delete process.env.IAM_DATABASE_URL;
    delete process.env.APP_DB_PASSWORD;
    delete process.env.POSTGRES_PASSWORD;
    const { loadInstanceByHostname } = await import('./server');

    await expect(
      loadInstanceByHostname('demo.studio.example.org', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('iam_database_url_missing');
  });

  it('builds a fallback IAM database URL from app database environment variables', async () => {
    delete process.env.IAM_DATABASE_URL;
    process.env.APP_DB_USER = 'sva_app';
    process.env.APP_DB_PASSWORD = 'demo-value/with+unsafe';
    process.env.POSTGRES_DB = 'sva_studio';
    process.env.POSTGRES_HOST = 'postgres';
    process.env.POSTGRES_PORT = '5432';

    const { loadInstanceByHostname } = await import('./server');
    resolveHostnameMock.mockResolvedValue(null);

    await expect(loadInstanceByHostname('demo.studio.example.org')).resolves.toBeNull();

    expect(PoolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString:
          'postgres://sva_app:demo-value%2Fwith%2Bunsafe@postgres:5432/sva_studio',
      })
    );
  });

  it('fails with a structured error when the IAM database URL is invalid', async () => {
    process.env.IAM_DATABASE_URL = '::not-a-url::';

    const { loadInstanceByHostname } = await import('./server');

    await expect(loadInstanceByHostname('demo.studio.example.org')).rejects.toThrow('iam_database_url_invalid');
  });

  it('loads, caches, invalidates, and refreshes hostname lookups', async () => {
    const { invalidateInstanceRegistryHost, loadInstanceByHostname, resetInstanceRegistryCache } = await import('./server');
    resolveHostnameMock.mockResolvedValue({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_100)
      .mockReturnValueOnce(1_100)
      .mockReturnValueOnce(7_000)
      .mockReturnValueOnce(7_000);
    const options = {
      cacheTtlMs: 5_000,
      now,
      getDatabaseUrl: () => 'postgres://iam',
    };

    await expect(loadInstanceByHostname('Demo.Studio.Example.org', options)).resolves.toMatchObject({
      instanceId: 'demo',
    });
    await loadInstanceByHostname('demo.studio.example.org', options);
    expect(resolveHostnameMock).toHaveBeenCalledTimes(1);

    invalidateInstanceRegistryHost('demo.studio.example.org');
    await loadInstanceByHostname('demo.studio.example.org', options);
    expect(resolveHostnameMock).toHaveBeenCalledTimes(2);

    resetInstanceRegistryCache();
    await loadInstanceByHostname('demo.studio.example.org', options);
    expect(resolveHostnameMock).toHaveBeenCalledTimes(3);
    expect(PoolMock).toHaveBeenCalledTimes(1);
  });

  it('scopes hostname cache entries by database url', async () => {
    const { loadInstanceByHostname, resetInstanceRegistryCache } = await import('./server');
    resolveHostnameMock
      .mockResolvedValueOnce({
        instanceId: 'demo-a',
        displayName: 'Demo A',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        instanceId: 'demo-b',
        displayName: 'Demo B',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

    await expect(
      loadInstanceByHostname('demo.studio.example.org', {
        getDatabaseUrl: () => 'postgres://iam-a',
      })
    ).resolves.toMatchObject({ instanceId: 'demo-a' });
    await expect(
      loadInstanceByHostname('demo.studio.example.org', {
        getDatabaseUrl: () => 'postgres://iam-b',
      })
    ).resolves.toMatchObject({ instanceId: 'demo-b' });

    expect(resolveHostnameMock).toHaveBeenCalledTimes(2);
    expect(PoolMock).toHaveBeenCalledTimes(2);
    resetInstanceRegistryCache();
  });

  it('resets cache and closes pooled database connections', async () => {
    const { loadInstanceByHostname, resetInstanceRegistryServerState } = await import('./server');
    resolveHostnameMock.mockResolvedValue({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await loadInstanceByHostname('demo.studio.example.org', {
      getDatabaseUrl: () => 'postgres://iam',
    });

    expect(PoolMock).toHaveBeenCalledTimes(1);
    await resetInstanceRegistryServerState();

    expect(poolInstances[0]?.end).toHaveBeenCalledTimes(1);
  });

  it('loads instances by id without using the hostname cache', async () => {
    const { loadInstanceById } = await import('./server');
    getInstanceByIdMock.mockResolvedValue({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      loadInstanceById('demo', {
        getDatabaseUrl: () => 'postgres://iam',
      })
    ).resolves.toMatchObject({ instanceId: 'demo' });

    expect(getInstanceByIdMock).toHaveBeenCalledWith('demo');
    expect(resolveHostnameMock).not.toHaveBeenCalled();
  });

  it('loads tenant client secret ciphertext by instance id through the shared repository connection', async () => {
    const { loadInstanceAuthClientSecretCiphertext } = await import('./server');
    getAuthClientSecretCiphertextMock.mockResolvedValue('enc:tenant-secret');

    await expect(
      loadInstanceAuthClientSecretCiphertext('bb-guben', {
        getDatabaseUrl: () => 'postgres://iam',
      })
    ).resolves.toBe('enc:tenant-secret');

    expect(getAuthClientSecretCiphertextMock).toHaveBeenCalledWith('bb-guben');
    expect(resolveHostnameMock).not.toHaveBeenCalled();
  });
});
