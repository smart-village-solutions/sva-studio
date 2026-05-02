import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

const record = {
  instanceId: 'tenant-a',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://main.example.test/graphql',
  oauthTokenUrl: 'https://main.example.test/oauth/token',
  enabled: true,
  lastVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastVerifiedStatus: 'ok',
};

describe('instance integrations server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reuses a custom cached loader until save clears it', async () => {
    const { loadInstanceIntegrationRecord, saveInstanceIntegrationRecord } = await import('./instance-integrations.server.js');

    const queries: string[] = [];
    const release = vi.fn();
    const connect = vi.fn(async () => ({
      query: vi.fn(async (text: string) => {
        queries.push(text);
        return { rowCount: 0, rows: [] };
      }),
      release,
    }));
    mocks.poolFactory.mockReturnValue({
      connect,
    });

    const loadRecord = vi.fn(async () => record);
    const options = {
      cacheTtlMs: 100,
      now: () => 1_000,
      getDatabaseUrl: () => 'postgres://db.example/sva',
      loadRecord,
    };

    await expect(loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', options)).resolves.toEqual(record);
    await expect(loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', options)).resolves.toEqual(record);
    expect(loadRecord).toHaveBeenCalledTimes(1);

    await saveInstanceIntegrationRecord(record, {
      getDatabaseUrl: () => 'postgres://db.example/sva',
    });

    await expect(loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', options)).resolves.toEqual(record);
    expect(loadRecord).toHaveBeenCalledTimes(2);
    expect(queries).toContain('BEGIN');
    expect(queries).toContain('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('fails fast when no IAM database url is configured', async () => {
    const { saveInstanceIntegrationRecord } = await import('./instance-integrations.server.js');

    await expect(
      saveInstanceIntegrationRecord(record, {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'database_not_configured',
      expect.objectContaining({
        operation: 'instance_integration_db_tx',
        instance_id: 'tenant-a',
      })
    );
  });

  it('logs pool connection failures before rethrowing them', async () => {
    const { loadInstanceIntegrationRecord } = await import('./instance-integrations.server.js');

    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => {
        throw new Error('connect failed');
      }),
    });

    await expect(
      loadInstanceIntegrationRecord('tenant-a', 'sva_mainserver', {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('connect failed');

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'pool_connect_failed',
      expect.objectContaining({
        operation: 'instance_integration_db_tx',
        instance_id: 'tenant-a',
        error: 'connect failed',
      })
    );
  });

  it('rolls back and releases the client when the repository write fails', async () => {
    const { saveInstanceIntegrationRecord } = await import('./instance-integrations.server.js');

    const release = vi.fn();
    const query = vi.fn(async (text: string) => {
      if (text.includes('INSERT INTO iam.instance_integrations')) {
        throw new Error('write failed');
      }
      return { rowCount: 0, rows: [] };
    });
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query,
        release,
      })),
    });

    await expect(
      saveInstanceIntegrationRecord(record, {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('write failed');

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'instance_integration_db_tx_rolled_back',
      expect.objectContaining({
        operation: 'instance_integration_db_tx',
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'instance_integration_db_tx_failed',
      expect.objectContaining({
        operation: 'instance_integration_db_tx',
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );
  });
});
