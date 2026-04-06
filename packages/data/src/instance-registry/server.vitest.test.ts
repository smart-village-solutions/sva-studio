import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const buildInvalidPostgresUrl = ({
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
}) => `${scheme}://${user}:${credential}@${host}:${port}/${database}`;

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
  }),
  iam_db_encoded: buildPostgresUrl({
    scheme: 'postgres',
    user: 'sva_app',
    credential: DB_CREDENTIAL,
    host: 'postgres.sva.docker',
    port: '5432',
    database: 'sva_studio',
  }),
} as const;

const INVALID_IAM_DB_URL = buildInvalidPostgresUrl({
  scheme: 'postgresql',
  user: TEST_FIXTURES.dbUser,
  credential: TEST_FIXTURES.dbCredential,
  host: TEST_FIXTURES.dbHost,
  port: TEST_FIXTURES.dbPort,
  database: TEST_FIXTURES.dbName,
});

const resolveHostnameMock = vi.hoisted(() => vi.fn());
const resolvePrimaryHostnameMock = vi.hoisted(() => vi.fn());
const getInstanceByIdMock = vi.hoisted(() => vi.fn());
const getAuthClientSecretCiphertextMock = vi.hoisted(() => vi.fn());
const createInstanceRegistryRepositoryMock = vi.hoisted(() =>
  vi.fn(() => ({
    resolveHostname: resolveHostnameMock,
    resolvePrimaryHostname: resolvePrimaryHostnameMock,
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
    resolvePrimaryHostnameMock.mockResolvedValue(null);
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
    process.env.APP_DB_PASSWORD = TEST_FIXTURES.dbCredential;
    process.env.POSTGRES_DB = 'sva_studio';
    process.env.POSTGRES_HOST = 'postgres';
    process.env.POSTGRES_PORT = '5432';

    const { loadInstanceByHostname } = await import('./server');
    resolveHostnameMock.mockResolvedValue(null);

    await expect(loadInstanceByHostname('demo.studio.example.org')).resolves.toBeNull();

    expect(PoolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: buildPostgresUrl({
          scheme: 'postgres',
          user: TEST_FIXTURES.dbUser,
          credential: TEST_FIXTURES.dbCredential,
          host: 'postgres',
          port: TEST_FIXTURES.dbPort,
          database: TEST_FIXTURES.dbName,
        }),
      })
    );
  });

  it('fails with a structured missing error when the explicit IAM database URL is invalid and no fallback credentials exist', async () => {
    process.env.IAM_DATABASE_URL = '::not-a-url::';
    delete process.env.APP_DB_PASSWORD;
    delete process.env.POSTGRES_PASSWORD;

    const { loadInstanceByHostname } = await import('./server');

    await expect(loadInstanceByHostname('demo.studio.example.org')).rejects.toThrow('iam_database_url_missing');
  });

  it('falls back to a derived IAM database URL when the explicit url is invalid', async () => {
    process.env.IAM_DATABASE_URL = INVALID_IAM_DB_URL;
    process.env.APP_DB_USER = 'sva_app';
    process.env.APP_DB_PASSWORD = TEST_FIXTURES.dbCredential;
    process.env.POSTGRES_DB = 'sva_studio';
    process.env.POSTGRES_HOST = 'postgres.sva.docker';
    process.env.POSTGRES_PORT = '5432';

    const { loadInstanceByHostname } = await import('./server');

    await expect(loadInstanceByHostname('bb-guben.studio.smart-village.app')).resolves.toBeNull();

    expect(PoolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: TEST_FIXTURES.iam_db_encoded,
      })
    );
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

  it('falls back to primary_hostname when the hostname registry has no row', async () => {
    const { loadInstanceByHostname } = await import('./server');
    resolveHostnameMock.mockResolvedValue(null);
    resolvePrimaryHostnameMock.mockResolvedValue({
      instanceId: 'bb-guben',
      displayName: 'BB Guben',
      status: 'active',
      parentDomain: 'studio.smart-village.app',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      loadInstanceByHostname('bb-guben.studio.smart-village.app', {
        getDatabaseUrl: () => 'postgres://iam',
      })
    ).resolves.toMatchObject({ instanceId: 'bb-guben' });

    expect(resolveHostnameMock).toHaveBeenCalledWith('bb-guben.studio.smart-village.app');
    expect(resolvePrimaryHostnameMock).toHaveBeenCalledWith('bb-guben.studio.smart-village.app');
  });

  it('falls back to primary_hostname when instance_hostnames is unavailable', async () => {
    const { loadInstanceByHostname } = await import('./server');
    resolveHostnameMock.mockRejectedValue(new Error('permission denied for table instance_hostnames'));
    resolvePrimaryHostnameMock.mockResolvedValue({
      instanceId: 'de-musterhausen',
      displayName: 'DE Musterhausen',
      status: 'active',
      parentDomain: 'studio.smart-village.app',
      primaryHostname: 'de-musterhausen.studio.smart-village.app',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      loadInstanceByHostname('de-musterhausen.studio.smart-village.app', {
        getDatabaseUrl: () => 'postgres://iam',
      })
    ).resolves.toMatchObject({ instanceId: 'de-musterhausen' });

    expect(resolvePrimaryHostnameMock).toHaveBeenCalledWith('de-musterhausen.studio.smart-village.app');
  });

  it('sanitizes repository-layer hostname lookup failures', async () => {
    const { loadInstanceByHostname } = await import('./server');
    resolveHostnameMock.mockRejectedValue(new Error('password authentication failed for user "sva_app"'));

    await expect(
      loadInstanceByHostname('de-musterhausen.studio.smart-village.app', {
        getDatabaseUrl: () => 'postgres://iam',
      })
    ).rejects.toThrow('tenant_host_resolution_failed');
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

  it('normalizes database urls before deriving hostname cache scope', async () => {
    const { loadInstanceByHostname, resetInstanceRegistryCache } = await import('./server');
    resolveHostnameMock.mockResolvedValue({
      instanceId: 'demo-a',
      displayName: 'Demo A',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(
      loadInstanceByHostname('demo.studio.example.org', {
        getDatabaseUrl: () => buildPostgresUrl({
          scheme: 'postgres',
          user: 'user',
          credential: 'cache scope value',
          host: 'db.example',
          port: '5432',
          database: 'sva',
        }),
      }),
    ).resolves.toMatchObject({ instanceId: 'demo-a' });
    await expect(
      loadInstanceByHostname('demo.studio.example.org', {
        getDatabaseUrl: () => buildPostgresUrl({
          scheme: 'postgres',
          user: 'user',
          credential: 'cache scope value',
          host: 'db.example',
          port: '5432',
          database: 'sva',
        }).replace('%20', ' '),
      }),
    ).resolves.toMatchObject({ instanceId: 'demo-a' });

    expect(resolveHostnameMock).toHaveBeenCalledTimes(1);
    expect(PoolMock).toHaveBeenCalledTimes(1);
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

  it('sanitizes error when fallback to primary_hostname also fails', async () => {
    const { loadInstanceByHostname } = await import('./server');
    resolveHostnameMock.mockRejectedValue(new Error('permission denied for table instance_hostnames'));
    resolvePrimaryHostnameMock.mockRejectedValue(new Error('connection timeout'));

    await expect(
      loadInstanceByHostname('de-error-case.studio.smart-village.app', {
        getDatabaseUrl: () => 'postgres://iam',
      })
    ).rejects.toThrow('tenant_host_resolution_fallback_failed');

    expect(resolvePrimaryHostnameMock).toHaveBeenCalledWith('de-error-case.studio.smart-village.app');
  });

  it('captures original fallback error in cause field without leaking message', async () => {
    const { loadInstanceByHostname } = await import('./server');
    const originalError = new Error('SENSITIVE_CONNECTION_STRING_HERE');
    resolveHostnameMock.mockRejectedValue(new Error('permission denied for table instance_hostnames'));
    resolvePrimaryHostnameMock.mockRejectedValue(originalError);

    try {
      await loadInstanceByHostname('de-sensitive.studio.smart-village.app', {
        getDatabaseUrl: () => 'postgres://iam',
      });
      throw new Error('Should have thrown');
    } catch (err: unknown) {
      const error = err as any;
      expect(error.message).toBe('tenant_host_resolution_fallback_failed');
      expect(error.cause).toBe(originalError);
      // Ensure original error message is NOT exposed in the thrown error message
      expect(error.message).not.toContain('SENSITIVE_CONNECTION_STRING_HERE');
    }
  });
});
